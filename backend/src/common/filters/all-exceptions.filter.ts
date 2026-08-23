// 全局异常过滤器：把所有异常归一为统一信封 {code, message, data:null}
// 对齐 docs/api/core-contracts.md §1（统一响应）/ §2（错误码体系）
// - HttpException：取异常 status 为 HTTP 状态；业务码取 payload.code
// - 业务码被误写成 HTTP 状态（如 422）→ 归位为通用校验码 4000 / 服务器码 5000
// - 未知错误：500 + 5000，不向客户端泄露内部信息（服务端 console.error 留痕）
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ERROR_CODES, ErrorCode } from '../error-codes';
import { messageOf } from '../error-messages';

const HTTP_STATUS_CODES = new Set([400, 401, 403, 404, 409, 422, 429, 500]);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private static readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number | undefined;
    let message = '';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const r = res as { code?: unknown; message?: unknown };
        if (typeof r.code === 'number') code = r.code;
        if (typeof r.message === 'string' && r.message) message = r.message;
      } else if (typeof res === 'string') {
        message = res;
      }
    } else {
      // 非预期异常：仅服务端留痕，绝不外泄堆栈
      AllExceptionsFilter.logger.error(
        `[UnhandledException] ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // 业务码缺省 → 按层级兜底
    if (code === undefined) {
      code = status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.PARAM_INVALID;
    }
    // 防御：业务码被误写成 HTTP 状态（违反 core-contracts §2）
    if (HTTP_STATUS_CODES.has(code)) {
      code = status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.PARAM_INVALID;
    }

    // 中央 message 优先；缺失时回退到抛出的 message；再缺失用通用文案
    const canonical = messageOf(code);
    if (canonical) {
      message = canonical;
    } else if (!message) {
      message = code === ERROR_CODES.INTERNAL_ERROR ? '服务器内部错误' : '请求失败';
    }

    reply.status(status).send({ code, message, data: null } as {
      code: ErrorCode;
      message: string;
      data: null;
    });
  }
}
