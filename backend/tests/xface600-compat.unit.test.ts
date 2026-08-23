import { parseXFaceRecords } from '../src/attendance/engine/xface-adapter';

/**
 * XFace600 兼容性契约测试（基于真实 ZKTeco 设备协议，非臆测）。
 * 参考：ZKTeco ADMS / PUSH 协议（iclock/cdata），设备主动 POST 打卡记录到服务端。
 *
 * 真实报文（设备 → 我们服务端）：
 *   POST /iclock/cdata?SN=DEV001&table=ATTLOG&Stamp=1
 *   Content-Type: text/plain
 *   Body: 1001\t2026-08-13 09:05:00\t1\t15\n1001\t2026-08-13 18:10:00\t1\t15
 *
 * 当前 src/attendance/engine/xface-adapter.ts 的 parseXFaceRecords 期望 JSON
 * { ret, rows:[{emp_code, punch_time, device_sn}] } —— 与真实设备报文格式不匹配。
 */
describe('XFace600 兼容性契约（真实设备协议）', () => {
  const realPushBody =
    '1001\t2026-08-13 09:05:00\t1\t15\n1001\t2026-08-13 18:10:00\t1\t15';
  const deviceSn = 'DEV001';

  it('RED: 真实 XFace600 推送报文(tab-separated)应被解析为打卡记录', () => {
    const result = parseXFaceRecords(realPushBody, deviceSn);
    expect(result).toEqual([
      {
        employeeNo: '1001',
        punchTime: new Date('2026-08-13 09:05:00'),
        deviceNo: 'DEV001',
        punchType: '1',
      },
      {
        employeeNo: '1001',
        punchTime: new Date('2026-08-13 18:10:00'),
        deviceNo: 'DEV001',
        punchType: '1',
      },
    ]);
  });
});
