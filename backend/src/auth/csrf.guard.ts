import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfService } from '../common/csrf.service';
import { ERROR_CODES } from '../common/error-codes';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method = req.method?.toUpperCase();

    if (SAFE_METHODS.has(method)) return true;

    const userId = req.user?.id;
    if (!userId) return true;

    const tokenHeader = req.headers['x-csrf-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!token || typeof token !== 'string') {
      throw new ForbiddenException({
        code: ERROR_CODES.CSRF_TOKEN_MISSING,
        message: 'CSRF token 缺失',
      });
    }

    const valid = await this.csrfService.validateToken(userId, token);
    if (!valid) {
      throw new ForbiddenException({
        code: ERROR_CODES.CSRF_TOKEN_INVALID,
        message: 'CSRF token 无效',
      });
    }

    return true;
  }
}
