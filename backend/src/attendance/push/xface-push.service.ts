// XFace600 / ZKTeco PUSH 协议解析与入库服务
// 真机出厂 Push 模式：设备主动 POST /iclock/cdata?SN=XXXX&table=ATTLOG
// 请求体为纯文本，每行一条记录，字段以 \t 分隔。
//   ATTLOG 行格式：工号 \t 时间 \t 类型 \t 验证方式 \t [其它...]
//   行可能带表名前缀（ATTLOG\t... / OPTIONS\t...），也可能裸行（table 由 query 指定）。
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** 解析后的 ATTLOG（打卡流水）记录 */
export interface CdataAttlogRecord {
  employeeNo: string;
  punchTime: Date;
  punchType?: string;
  verifyType?: string;
  deviceNo: string;
  raw: string;
}

/** 解析后的 OPTIONS（设备选项）记录 */
export interface CdataOption {
  key: string;
  value: string;
}

/** parseCdataBody 的返回结构 */
export interface ParsedCdata {
  attlogs: CdataAttlogRecord[];
  options: CdataOption[];
}

/** 已知的 ZK PUSH 表名（行前缀），其余视为未知表忽略 */
const KNOWN_TABLES = new Set([
  'ATTLOG',
  'OPTIONS',
  'USER',
  'FINGERTMP',
  'SMS',
  'OPERLOG',
  'ATTPHOTO',
]);

@Injectable()
export class XFacePushService {
  private readonly logger = new Logger(XFacePushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析 PUSH 请求体纯文本。
   * - 空体 → 返回空结构（设备心跳）
   * - 每行按 \t 拆分；首字段为已知表名时按表解析，否则按 ATTLOG 裸行解析
   * - 裸行第 2 字段非时间 → 视作 OPTIONS（key\tvalue）
   */
  parseCdataBody(body: string, sn: string): ParsedCdata {
    const result: ParsedCdata = { attlogs: [], options: [] };
    if (!body || !body.trim()) return result;

    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split('\t');
      let table: string | null = null;
      let fields = cols;

      // 识别行首表名前缀
      if (KNOWN_TABLES.has(cols[0])) {
        table = cols[0];
        fields = cols.slice(1);
      }

      if (table === 'OPTIONS') {
        const opt = this.parseOption(fields);
        if (opt) result.options.push(opt);
        continue;
      }

      if (table === 'ATTLOG') {
        const rec = this.parseAttlog(fields, sn, line);
        if (rec) result.attlogs.push(rec);
        continue;
      }

      // 裸行：依据第 2 字段是否为时间判定 ATTLOG / OPTIONS
      if (table === null) {
        if (fields.length >= 2 && this.isDateTime(fields[1])) {
          const rec = this.parseAttlog(fields, sn, line);
          if (rec) result.attlogs.push(rec);
        } else if (fields.length >= 2) {
          const opt = this.parseOption(fields);
          if (opt) result.options.push(opt);
        }
      }
    }
    return result;
  }

  /**
   * 将 ATTLOG 记录入库（去重）。
   * 去重依据：PunchLog 唯一约束 (employeeNo, punchTime, deviceNo)。
   * @returns inserted 新增条数；skipped 跳过（已存在/非法）条数
   */
  async syncToPunchLogs(
    records: CdataAttlogRecord[],
    deviceSn: string,
  ): Promise<{ inserted: number; skipped: number }> {
    if (!records || records.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const valid = records.filter(
      (r) => r.employeeNo && r.punchTime && !isNaN(r.punchTime.getTime()),
    );
    if (valid.length === 0) {
      return { inserted: 0, skipped: records.length };
    }

    // 按时间范围拉取已有记录，内存去重（与 punch-sync.service 一致策略）
    const times = valid.map((r) => r.punchTime.getTime());
    const minTime = new Date(Math.min(...times));
    const maxTime = new Date(Math.max(...times));

    const existing = await this.prisma.punchLog.findMany({
      where: {
        deviceNo: deviceSn,
        punchTime: { gte: minTime, lte: maxTime },
      },
      select: { employeeNo: true, punchTime: true, deviceNo: true },
    });
    const existingKeys = new Set(
      existing.map(
        (e) => `${e.employeeNo}|${e.punchTime.getTime()}|${e.deviceNo}`,
      ),
    );

    const newRecords = valid.filter(
      (r) => !existingKeys.has(`${r.employeeNo}|${r.punchTime.getTime()}|${r.deviceNo}`),
    );

    let inserted = 0;
    if (newRecords.length > 0) {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const r of newRecords) {
            await tx.punchLog.create({
              data: {
                employeeNo: r.employeeNo,
                deviceNo: r.deviceNo || deviceSn,
                punchTime: r.punchTime,
                punchType: r.punchType,
                source: 'api',
                status: 'pending',
                rawData: r.raw.length > 500 ? r.raw.slice(0, 500) : r.raw,
              },
            });
            inserted++;
          }
        });
      } catch (e: any) {
        // 并发场景下唯一约束冲突 → 视为已存在，跳过
        if (e?.code === 'P2002') {
          this.logger.warn(
            `PUSH 入库命中唯一约束（并发重复），deviceSn=${deviceSn}，跳过 ${newRecords.length} 条`,
          );
          return { inserted: 0, skipped: records.length };
        }
        throw e;
      }
    }

    return { inserted, skipped: records.length - inserted };
  }

  private parseAttlog(
    fields: string[],
    sn: string,
    raw: string,
  ): CdataAttlogRecord | null {
    if (fields.length < 2) return null;
    const employeeNo = (fields[0] ?? '').trim();
    const punchTimeStr = (fields[1] ?? '').trim();
    if (!employeeNo || !punchTimeStr) return null;

    const punchTime = new Date(punchTimeStr);
    if (isNaN(punchTime.getTime())) return null;

    return {
      employeeNo,
      punchTime,
      punchType: (fields[2] ?? '').trim() || undefined,
      verifyType: (fields[3] ?? '').trim() || undefined,
      deviceNo: sn,
      raw,
    };
  }

  private parseOption(fields: string[]): CdataOption | null {
    if (fields.length < 2) return null;
    const key = (fields[0] ?? '').trim();
    if (!key) return null;
    return { key, value: fields.slice(1).join('\t') };
  }

  private isDateTime(s: string): boolean {
    if (!s) return false;
    const d = new Date(s);
    return !isNaN(d.getTime());
  }
}
