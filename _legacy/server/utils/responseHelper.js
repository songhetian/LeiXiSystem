/**
 * 统一 API 响应助手
 * 确保全系统返回结构一致：{ success: boolean, message: string, data?: any, errorCode?: string }
 */
class ResponseHelper {
  /**
   * 成功响应
   */
  static success(reply, data = null, message = '操作成功') {
    return reply.send({
      success: true,
      message,
      data
    });
  }

  /**
   * 错误响应
   */
  static error(reply, message = '操作失败', statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    return reply.code(statusCode).send({
      success: false,
      message,
      errorCode
    });
  }

  /**
   * 参数验证错误
   */
  static badRequest(reply, message = '请求参数有误') {
    return this.error(reply, message, 400, 'BAD_REQUEST');
  }

  /**
   * 权限不足
   */
  static forbidden(reply, message = '您没有执行此操作的权限') {
    return this.error(reply, message, 403, 'FORBIDDEN');
  }

  /**
   * 未登录/Token过期
   */
  static unauthorized(reply, message = '登录已失效，请重新登录') {
    return this.error(reply, message, 401, 'UNAUTHORIZED');
  }
}

module.exports = ResponseHelper;