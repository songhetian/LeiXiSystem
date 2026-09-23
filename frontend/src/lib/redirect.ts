/**
 * 整页跳转到登录页（会话过期等场景）。
 * 独立成函数便于在测试中通过 jest.mock 替换，验证跳转是否发生。
 */
export function redirectToLogin(target = '/login') {
  if (typeof window === 'undefined') return;
  window.location.assign(target);
}