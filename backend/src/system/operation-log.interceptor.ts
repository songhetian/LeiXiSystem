import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OperationLogService } from './operation-log.service';
import { maskSensitiveFields } from '../common/sensitive-mask.util';

const WRITE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/** 跳过 body 记录的路径（如登录、改密，body 含明文密码）。 */
const SKIP_BODY_PATHS = ['/api/v1/auth/login', '/api/v1/auth/change-password', '/api/v1/auth/reset-password'];

const LOG_MODULE_MAP: Record<string, string> = {
  'system': '系统管理',
  'employees': '员工管理',
  'attendance': '考勤管理',
  'payroll': '薪资管理',
  'payslips': '工资条',
  'knowledge': '知识库',
  'leave-records': '请假管理',
  'overtime-records': '加班管理',
  'shifts': '班次管理',
  'schedules': '排班管理',
  'auth': '认证',
  'approval': '审批管理',
  'reimbursements': '报销管理',
  'reports': '报表中心',
  'settings': '系统设置',
  'notifications': '通知中心',
  'vacation': '假期管理',
  'broadcasts': '公告管理',
};

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(private readonly operationLogService: OperationLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (!WRITE_METHODS.includes(method)) {
      return next.handle();
    }

    const url = request.url || request.raw?.url;
    const path = url?.split('?')[0] || '';
    const module = this.detectModule(path);

    if (!module) {
      return next.handle();
    }

    const user = request.user;
    const action = this.detectAction(method, path);
    const skipBody = SKIP_BODY_PATHS.some((p) => path.startsWith(p));
    const bodyToLog = skipBody ? undefined : (request.body ? maskSensitiveFields(request.body) : undefined);
    const params = bodyToLog ? JSON.stringify(bodyToLog).slice(0, 2000) : undefined;
    const ip = request.ip || request.headers?.['x-forwarded-for'] || request.raw?.ip;

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const maskedResult = data ? maskSensitiveFields(data) : undefined;
          const resultStr = maskedResult ? JSON.stringify(maskedResult).slice(0, 500) : undefined;
          this.operationLogService.createLog({
            userId: user?.id,
            username: user?.username,
            module,
            action,
            method,
            url: path,
            ip: Array.isArray(ip) ? ip[0] : ip,
            params,
            result: resultStr,
            status: 'success',
          }).catch(() => {});
        },
        error: (err) => {
          const errMsg = err?.message ? String(err.message).slice(0, 500) : undefined;
          const maskedErr = errMsg ? maskSensitiveFields({ error: errMsg }) : undefined;
          this.operationLogService.createLog({
            userId: user?.id,
            username: user?.username,
            module,
            action,
            method,
            url: path,
            ip: Array.isArray(ip) ? ip[0] : ip,
            params,
            result: maskedErr ? JSON.stringify(maskedErr).slice(0, 500) : undefined,
            status: 'failed',
          }).catch(() => {});
        },
      }),
    );
  }

  private detectModule(path: string): string | null {
    const segments = path.replace(/^\/api\/v1\//, '').split('/');
    const first = segments[0];
    return LOG_MODULE_MAP[first] || null;
  }

  private detectAction(method: string, path: string): string {
    const segments = path.replace(/^\/api\/v1\//, '').split('/');
    const actionMap: Record<string, string> = {
      POST: '创建',
      PUT: '修改',
      DELETE: '删除',
      PATCH: '更新',
    };
    const action = actionMap[method] || method;
    const resource = segments[1] || '';
    if (path.includes('/publish')) return '发布';
    if (path.includes('/confirm')) return '确认';
    if (path.includes('/view')) return '查看';
    if (resource === 'login') return '登录';
    if (segments.length >= 3 && /^\d+$/.test(segments[2])) {
      return `${action}${this.getResourceName(segments[1])}`;
    }
    return `${action}${this.getResourceName(segments[1] || segments[0])}`;
  }

  private getResourceName(segment: string): string {
    const map: Record<string, string> = {
      broadcasts: '公告',
      users: '用户',
      roles: '角色',
      employees: '员工',
      categories: '分类',
      articles: '文章',
      attachments: '附件',
    };
    return map[segment] || segment;
  }
}
