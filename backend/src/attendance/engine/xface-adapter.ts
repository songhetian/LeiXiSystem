import { BadGatewayException } from '@nestjs/common';

export interface XFaceRecord {
  employeeNo: string;
  punchTime: Date;
  deviceNo: string;
  punchType?: string;
}

interface XFaceApiResponse {
  ret: number;
  total?: number;
  rows?: any[];
  msg?: string;
}

export function parseXFaceRecords(response: XFaceApiResponse | string, deviceSn = 'unknown'): XFaceRecord[] {
  if (typeof response === 'string') {
    return parseTabDelimited(response, deviceSn);
  }
  if (!response || typeof response !== 'object') {
    throw new BadGatewayException({ code: 2008, message: 'XFace API 响应为空或无效' });
  }
  if (response.ret !== 0) {
    throw new BadGatewayException({ code: 2008, message: `XFace API 错误: ${response.msg || 'ret=' + response.ret}` });
  }
  if (!response.rows || !Array.isArray(response.rows)) {
    return [];
  }

  const records: XFaceRecord[] = [];
  for (const row of response.rows) {
    const empCode = row.emp_code || row.employeeNo || row.empCode;
    const punchTimeStr = row.punch_time || row.punchTime || row.time;
    const deviceNo = row.device_sn || row.deviceSn || row.sn || row.serial_no || deviceSn;
    const punchType = row.punch_type || row.punchType;

    if (!empCode || !punchTimeStr) {
      continue;
    }

    const punchTime = new Date(punchTimeStr);
    if (isNaN(punchTime.getTime())) {
      continue;
    }

    records.push({
      employeeNo: empCode,
      punchTime,
      deviceNo,
      punchType,
    });
  }
  return records;
}

function parseTabDelimited(body: string, deviceSn: string): XFaceRecord[] {
  const records: XFaceRecord[] = [];
  const lines = body.trim().split('\n');
  for (const line of lines) {
    const parts = line.trim().split('\t');
    if (parts.length < 2) continue;
    const employeeNo = parts[0].trim();
    const punchTimeStr = parts[1].trim();
    const punchType = parts[2]?.trim();
    if (!employeeNo || !punchTimeStr) continue;
    const punchTime = new Date(punchTimeStr);
    if (isNaN(punchTime.getTime())) continue;
    records.push({ employeeNo, punchTime, deviceNo: deviceSn, punchType });
  }
  return records;
}

export function buildLastSyncTimeCursor(lastSyncTime: Date | null): string {
  const date = lastSyncTime
    ? lastSyncTime
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
      })();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

export function filterNewRecords(
  newRecords: XFaceRecord[],
  existingRecords: { employeeNo: string; punchTime: Date; deviceNo: string }[],
): XFaceRecord[] {
  const existingKeys = new Set(
    existingRecords.map(
      (r) => `${r.employeeNo}|${r.punchTime.getTime()}|${r.deviceNo}`,
    ),
  );

  return newRecords.filter((r) => {
    const key = `${r.employeeNo}|${r.punchTime.getTime()}|${r.deviceNo}`;
    return !existingKeys.has(key);
  });
}
