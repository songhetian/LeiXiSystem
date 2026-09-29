/**
 * 业务编码自动生成：prefix + 14位日期时间(YYYYMMDDHHmmss) + 3位随机数。
 * 对齐老项目 BX 报销单号格式（backend/src/reimbursement/reimbursement.service.ts generateReimbursementNo）。
 * 用于参考/设置类编码在未手动填写时由后端自动生成，避免用户手填英文编码。
 *
 * 时间戳按北京时间生成（见 beijingTimestamp），不能用本地 getter：UTC 容器下会偏 8 小时。
 *
 * 同秒内的唯一性不能靠 3 位随机数赌博（碰撞概率 1/1000）：报销单号有 P2002 重试兜底，
 * 但报销类型编码没有重试，一次碰撞就直接报「报销类型编码已存在」。
 * 因此单进程内记住上一枚「时间戳 + 后缀」，时间戳未变时在上一枚后缀上单调 +1。
 */
import { beijingTimestamp } from './date.util';

let lastTimestamp = '';
let lastRand = -1;

export function generateAutoCode(prefix: string): string {
  const timestamp = beijingTimestamp();
  // 同一秒内递推：%1000 仅为维持 3 位后缀格式，单秒千次生成在业务上不可达
  const rand =
    timestamp === lastTimestamp ? (lastRand + 1) % 1000 : Math.floor(Math.random() * 1000);
  lastTimestamp = timestamp;
  lastRand = rand;
  return `${prefix}${timestamp}${String(rand).padStart(3, '0')}`;
}