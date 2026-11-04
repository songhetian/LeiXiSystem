import LoaderDots from '@/components/LoaderDots';

/**
 * 路由级加载兜底：
 * 页面 JS chunk 尚未就绪或服务端渲染等待时，先给出品牌化的加载态，
 * 避免导航到重页面时出现空白。与 ProtectedRoute 的启动态共用 .lx-boot-screen。
 */
export default function RootLoading() {
  return (
    <div className="lx-boot-screen min-h-dvh">
      <LoaderDots text="正在加载页面" />
    </div>
  );
}
