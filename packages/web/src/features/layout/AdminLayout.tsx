import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../auth/store';
import { useLogout } from '../auth/hooks';
import { RequirePermission } from '../auth/permission';
import { ThemeToggle } from '../../components/ui/theme';
import { MENU_GROUPS, MENU_ITEMS, BrandMark } from './menu';
import { NotificationListener } from '../notify/NotificationListener';

/** 后台布局：左侧按权限分组菜单 + 顶栏用户信息，内容区渲染嵌套路由 */
export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const logout = useLogout();
  const navigate = useNavigate();

  const initial = user?.realName?.trim().charAt(0) ?? '雷';

  return (
    <div className="flex min-h-screen bg-page">
      <NotificationListener />
      {/* 侧边栏：深色石墨，专业对比 */}
      <aside className="sticky top-0 z-20 flex h-screen w-60 shrink-0 flex-col bg-brand-950 text-white">
        {/* 品牌区 */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <BrandMark className="h-8 w-8 rounded-md" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-white">雷犀内管系统</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
              LeiXi · Console
            </div>
          </div>
        </div>

        {/* 菜单（按分组） */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {MENU_GROUPS.map((group) => {
            const items = MENU_ITEMS.filter((it) => it.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-5 last:mb-0">
                <span className="px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
                  {group}
                </span>
                <ul className="mt-1.5 space-y-0.5">
                  {items.map((item) => (
                    <li key={item.path}>
                      <RequirePermission code={item.permission}>
                        <NavLink to={item.path} className="block rounded-md text-sm">
                          {({ isActive }) => (
                            <span
                              className={twMerge(
                                'flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors',
                                isActive
                                  ? 'bg-white/10 font-medium text-white'
                                  : 'text-white/60 hover:bg-white/5 hover:text-white',
                              )}
                            >
                              <item.icon
                                className={twMerge(
                                  'h-[18px] w-[18px] shrink-0',
                                  isActive ? 'text-white' : 'text-white/45 group-hover:text-white',
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                            </span>
                          )}
                        </NavLink>
                      </RequirePermission>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* 底部版本 */}
        <div className="border-t border-white/10 px-4 py-2.5">
          <p className="text-[11px] text-white/35">
            雷犀管理系统 · v0.9
            <span className="mx-1 text-white/20">/</span>
            内部使用
          </p>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-page/85 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="text-sm font-semibold text-ink">{user?.realName}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              已登录
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-ink ring-1 ring-inset ring-brand-ink/20 md:inline-flex">
              {permissions.length} 项权限
            </span>

            <ThemeToggle />

            <div className="flex items-center gap-2.5 border-l border-line pl-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-sm font-medium text-white">
                {initial}
              </span>
              <span className="hidden font-medium text-ink sm:block">{user?.realName}</span>
              <button
                type="button"
                onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </button>
            </div>
          </div>
        </header>

        {/* 内容区：随窗口滚动，无内部固定高度 */}
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}