import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseXFaceRecords, buildLastSyncTimeCursor, filterNewRecords, XFaceRecord } from './engine/xface-adapter';
import { ACTIVE_EMPLOYEE_STATUSES } from '../common/employee-status';
import { Cron } from '@nestjs/schedule';
import { errorCode, errorStatus, errorMessage } from '../common/error.util';
import { DistributedLockService, LockAcquisitionError } from '../common/distributed-lock.service';

const LOCK_TTL_MS = 120_000;

@Injectable()
export class PunchSyncService {
  private readonly logger = new Logger(PunchSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lockService: DistributedLockService,
  ) {}

  async getSyncStatus() {
    const devices = await this.prisma.punchDevice.findMany({
      where: { enabled: true },
    });

    const syncStates = await this.prisma.punchSyncState.findMany();
    const syncStateMap = new Map(syncStates.map(s => [s.deviceNo, s]));

    const defaultTime = new Date();
    defaultTime.setDate(defaultTime.getDate() - 30);

    let lastSyncTime: Date | null = null;
    let deviceCount = 0;
    let onlineCount = 0;

    for (const d of devices) {
      deviceCount++;
      if (d.status === 'online') onlineCount++;
      const t = syncStateMap.get(d.deviceNo)?.lastSyncTime || d.lastSyncTime;
      if (t && (!lastSyncTime || t > lastSyncTime)) {
        lastSyncTime = t;
      }
    }

    if (syncStates.length > 0 && !lastSyncTime) {
      lastSyncTime = syncStates.reduce((latest, s) => s.lastSyncTime > latest ? s.lastSyncTime : latest, syncStates[0].lastSyncTime);
    }

    return {
      lastSyncTime: lastSyncTime || defaultTime,
      deviceCount,
      onlineCount,
      deviceStatus: deviceCount > 0 ? (onlineCount === deviceCount ? 'online' : 'partial') : 'offline',
    };
  }

  async syncNow(): Promise<{ newCount: number; source: string }> {
    let totalNew = 0;
    let hasError = false;
    let firstError: any = null;

    const devices = await this.prisma.punchDevice.findMany({
      where: { enabled: true },
    });

    if (devices.length === 0) {
      try {
        const defaultDeviceNo = 'DEV001';
        const newRecords = await this.syncFromDevice(defaultDeviceNo, '');
        totalNew = newRecords.length;
        return { newCount: totalNew, source: 'api' };
      } catch (e) {
        if (errorStatus(e) === 502) throw e;
        throw new BadGatewayException({ code: 2006, message: `打卡设备连接失败: ${errorMessage(e)}` });
      }
    }

    for (const device of devices) {
      try {
        const syncState = await this.prisma.punchSyncState.findUnique({
          where: { deviceNo: device.deviceNo },
        });
        const lastSyncTime = syncState?.lastSyncTime || null;
        const newRecords = await this.syncFromDevice(
          device.deviceNo,
          device.ipAddress,
          device.port,
          lastSyncTime,
          device.apiKey ?? undefined,
        );
        totalNew += newRecords.length;
      } catch (e) {
        // 另一条链路正在同步同一台设备 → 跳过即可，不必记为设备故障
        if (e instanceof LockAcquisitionError) {
          this.logger.warn(`设备 ${device.deviceNo} 正在同步中，本次跳过`);
          continue;
        }
        this.logger.error(`同步设备 ${device.deviceNo} 失败: ${errorMessage(e)}`);
        await this.prisma.punchSyncState.upsert({
          where: { deviceNo: device.deviceNo },
          update: { lastError: errorMessage(e) },
          create: {
            deviceNo: device.deviceNo,
            lastSyncTime: new Date(0),
            lastError: errorMessage(e),
          },
        });
      }
    }

    return { newCount: totalNew, source: 'api' };
  }

  private async syncFromDevice(
    deviceNo: string,
    ipAddress: string,
    port = 80,
    lastSyncTime: Date | null = null,
    apiKey?: string,
  ): Promise<XFaceRecord[]> {
    // 按设备加锁：定时增量与手动 syncNow 是两条独立链路，并发时「先查后写」的窗口
    // 会让同一批记录被写两次；唯一约束虽然兜底不脏写，但会让整台设备批次回滚。
    return this.lockService.withLock(`punch:sync:${deviceNo}`, LOCK_TTL_MS, async () => {
      const apiResponse = await this.fetchFromDevice(ipAddress, port, lastSyncTime, apiKey);
      const records = parseXFaceRecords(apiResponse);

      const validNos = await this.getValidEmployeeNos(records.map(r => r.employeeNo));
      const validRecords = records.filter(r => validNos.has(r.employeeNo));

      const existingRecords = await this.getExistingRecordsForTimeRange(validRecords, deviceNo);
      const newRecords = filterNewRecords(validRecords, existingRecords);

      if (newRecords.length > 0) {
        await this.persistRecords(newRecords, deviceNo);
      }

      const latestTime = records.length > 0
        ? records.reduce((latest, r) => r.punchTime > latest ? r.punchTime : latest, records[0].punchTime)
        : new Date();

      await this.prisma.punchSyncState.upsert({
        where: { deviceNo },
        update: {
          lastSyncTime: latestTime,
          lastSyncCount: newRecords.length,
          totalSynced: { increment: newRecords.length },
          lastError: null,
        },
        create: {
          deviceNo,
          lastSyncTime: latestTime,
          lastSyncCount: newRecords.length,
          totalSynced: newRecords.length,
        },
      });

      return newRecords;
    });
  }

  /**
   * 批量落库。用 `skipDuplicates` 把去重职责交给 DB 唯一约束
   * （`@@unique([employeeNo, punchTime, deviceNo])`）——这样即使并发撞车，
   * 也只是跳过重复行，不会让整批记录因 P2002 回滚。
   */
  private async persistRecords(records: XFaceRecord[], deviceNo: string): Promise<void> {
    try {
      await this.prisma.punchLog.createMany({
        data: records.map((record) => ({
          employeeNo: record.employeeNo,
          punchTime: record.punchTime,
          deviceNo: record.deviceNo || deviceNo,
          punchType: record.punchType,
          source: 'api',
          status: 'pending',
          rawData: JSON.stringify(record),
        })),
        skipDuplicates: true,
      });
    } catch (e) {
      // 兜底：唯一约束之外仍有并发冲突时，跳过而不让整台设备同步失败。
      if (errorCode(e) === 'P2002') {
        this.logger.warn(`打卡落库存在重复记录，已跳过冲突行：deviceNo=${deviceNo}`);
        return;
      }
      throw e;
    }
  }

  async fetchFromDevice(
    ipAddress: string,
    port: number,
    lastSyncTime: Date | null,
    apiKey?: string,
  ): Promise<any> {
    const cursor = buildLastSyncTimeCursor(lastSyncTime);
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
    const url = `http://${ipAddress}:${port}/api/attendance/getRecord?lastSyncTime=${encodeURIComponent(cursor)}${keyParam}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (e) {
      throw new BadGatewayException({ code: 2006, message: `打卡设备连接失败: ${errorMessage(e)}` });
    }
  }

  private async getValidEmployeeNos(nos: string[]): Promise<Set<string>> {
    const emps = await this.prisma.employee.findMany({
      where: { employeeNo: { in: nos }, status: { in: ACTIVE_EMPLOYEE_STATUSES } },
      select: { employeeNo: true },
    });
    return new Set(emps.map(e => e.employeeNo));
  }

  private async getExistingRecordsForTimeRange(
    records: XFaceRecord[],
    deviceNo: string,
  ): Promise<{ employeeNo: string; punchTime: Date; deviceNo: string }[]> {
    if (records.length === 0) return [];

    const times = records.map(r => r.punchTime);
    const minTime = new Date(Math.min(...times.map(t => t.getTime())));
    const maxTime = new Date(Math.max(...times.map(t => t.getTime())));

    const existing = await this.prisma.punchLog.findMany({
      where: {
        deviceNo,
        punchTime: { gte: minTime, lte: maxTime },
      },
      select: {
        employeeNo: true,
        punchTime: true,
        deviceNo: true,
      },
    });

    return existing;
  }

  @Cron('0 */15 * * * *')
  async handleScheduledSync() {
    this.logger.log('定时任务：开始15分钟增量同步打卡记录');
    try {
      const result = await this.syncNow();
      this.logger.log(`定时任务：同步完成，新增 ${result.newCount} 条记录`);
    } catch (e) {
      this.logger.error(`定时任务：同步失败 - ${errorMessage(e)}`);
    }
  }

  // 长子任务语义：按北京时间 00:30 触发，避免容器 TZ=UTC 时错位到北京 08:30
  @Cron('0 30 0 * * *', { timeZone: 'Asia/Shanghai' })
  async handleDailyFullSync() {
    this.logger.log('定时任务：开始每日00:30完整性校验同步');
    try {
      const result = await this.syncNow();
      this.logger.log(`每日完整性校验完成，新增 ${result.newCount} 条记录`);
    } catch (e) {
      this.logger.error(`每日完整性校验失败 - ${errorMessage(e)}`);
    }
  }
}
