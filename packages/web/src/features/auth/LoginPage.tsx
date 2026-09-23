import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { ArrowRight, KeyRound, UserRound } from 'lucide-react';
import { useLogin } from './hooks';
import { BrandMark } from '../layout/menu';

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => {
        toast.success('欢迎回来');
        navigate('/', { replace: true });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const inputCls =
    'w-full rounded-lg border border-line-strong bg-panel py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none ' +
    'transition placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15';

  return (
    <div className="flex min-h-screen bg-page">
      {/* 左侧品牌面板 */}
      <div className="relative hidden w-[42%] overflow-hidden bg-brand-900 lg:block">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-2.5 text-white">
            <BrandMark className="h-9 w-9 rounded-lg" />
            <div className="leading-tight">
              <div className="font-display text-lg font-bold tracking-tight">雷犀内管系统</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200/80">
                LeiXi · Console
              </div>
            </div>
          </div>

          <div className="max-w-sm space-y-3 text-brand-50">
            <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-white">
              统一权限，一处从容管理。
            </p>
            <p className="text-sm leading-relaxed text-brand-100/80">
              角色、页面、动作、部门数据四级隔离，让每一次访问都有迹可循。
            </p>
          </div>

          <p className="text-xs text-brand-200/50">© 2026 LeiXi Internal Console</p>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm rounded-lg border border-line bg-panel p-7 shadow-soft"
        >
          <div className="lg:hidden">
            <BrandMark className="h-10 w-10 rounded-lg" />
          </div>
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink lg:mt-0">登录系统</h1>
          <p className="mt-1 text-sm text-muted">请使用你的账号继续访问内部工作台</p>

          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-muted">用户名</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input {...register('username')} autoComplete="username" placeholder="请输入用户名" className={inputCls} />
              </div>
              {errors.username && <span className="block text-xs text-red-500">{errors.username.message}</span>}
            </label>

            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-muted">密码</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  className={inputCls}
                />
              </div>
              {errors.password && <span className="block text-xs text-red-500">{errors.password.message}</span>}
            </label>
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.99 }}
            disabled={login.isPending}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-600 text-sm font-medium text-white shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {login.isPending ? '登录中…' : '登录'}
            {!login.isPending && <ArrowRight className="h-4 w-4" />}
          </motion.button>
        </motion.form>
      </div>
    </div>
  );
}