// 业务异常：携带 4 位错误码 + HTTP 状态；message 由全局过滤器从中央表统一填充
// 用法：throw new BizException(ERROR_CODES.EMPLOYEE_PHONE_INVALID, 422)
import { HttpException, HttpStatus } from '@nestjs/common';

export class BizException extends HttpException {
  constructor(
    public readonly bizCode: number,
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    super({ code: bizCode }, status);
  }
}
