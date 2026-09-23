/**
 * 文件存储驱动接口。
 * 后端统一经 FilesService 委托到具体驱动，从而支持"开发用本地磁盘、生产接 OSS"
 * 的可配置存储策略（见 ADR-0016）。新增存储（如阿里云 OSS）只需实现本接口并
 * 在 FilesModule 按 FILE_STORAGE 环境变量切换注入。
 */
export interface StorageDriver {
  /**
   * 保存上传缓冲到目标存储，返回可入库的相对 URL 与原始文件名。
   * @param buffer 文件内容
   * @param originalName 原始文件名（仅取扩展名规整用途）
   * @param bizType 业务目录（reimbursement/common 等），须符合安全字符集
   */
  save(
    buffer: Buffer,
    originalName: string,
    bizType: string,
  ): Promise<{ url: string; fileName: string }>;

  /**
   * 按入库 URL（/uploads/{bizType}/{name}）打开文件的可读流。
   * 本地磁盘返回文件读流；OSS 驱动返回 OSS 对象读流，使上层下载逻辑不感知底层存储。
   * @param fileUrl 入库 URL（相对 /uploads/...）
   */
  readStream(fileUrl: string): Promise<{ stream: import('stream').Readable }>;
}