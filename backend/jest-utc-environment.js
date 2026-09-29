// 以非北京时区（UTC）运行指定用例的自定义 jest 环境。
//
// 生产容器不设置 TZ，运行时即为 UTC；而开发机通常是 GMT+8。若代码用
// `new Date('YYYY-MM-DD HH:mm')` 或 `getHours()` 这类按服务器本地时区的解析/取值，
// 在 GMT+8 开发机上会"碰巧"得到正确结果，时区 bug 永远测不出来。
//
// 用法：在 spec 文件顶部加一行注释
//   /** @jest-environment ./jest-utc-environment */
const Module = require('jest-environment-node');
const NodeEnvironment = Module.default ?? Module;

class UtcEnvironment extends NodeEnvironment {
  constructor(config, context) {
    // 必须在任何 Date 解析发生前写入：Node 会在真实 process.env.TZ 被赋值时重载时区数据
    const previousTz = process.env.TZ;
    // 构造时先记下宿主真实时区（开发机 Asia/Shanghai / 生产容器 UTC），收尾时要用它做一次
    // 真实赋值才能把时区缓存拉回来（见 teardown）。
    const hostTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    process.env.TZ = 'UTC';
    super(config, context);
    this.previousTz = previousTz;
    this.hostTz = hostTz;
  }

  /**
   * 文件级收尾时还原调用方时区。
   *
   * `jest --runInBand`（以及复用 worker）下同一进程会连续执行多个 spec 文件，
   * 而 process.env.TZ 是进程级状态：不还原就会把 UTC 泄漏给后续文件，
   * 使按宿主时区构造时刻的用例随机失败（实测 punch.service.spec.ts 会连挂 8 条）。
   *
   * 注意 `delete process.env.TZ` **不会**触发 V8 的时区重载（实测删掉后 `getHours()`
   * 仍按 UTC 取值），所以宿主本来就没设置 TZ 时（开发机默认），必须先显式赋回宿主时区
   * 强制重载，再删除变量以保留「未设置」语义；否则同进程后续文件会一直停在 UTC。
   */
  async teardown() {
    if (this.previousTz === undefined) {
      if (this.hostTz) process.env.TZ = this.hostTz;
      delete process.env.TZ;
    } else {
      process.env.TZ = this.previousTz;
    }
    await super.teardown?.();
  }
}

module.exports = UtcEnvironment;