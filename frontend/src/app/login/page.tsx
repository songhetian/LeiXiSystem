'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Form, Input, Button, Typography, Message, Alert, Checkbox } from '@arco-design/web-react';
import { IconCheckCircle, IconClockCircle, IconSafe } from '@arco-design/web-react/icon';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { useSystemInfo } from '@/hooks/use-system-info';

/** 「记住账号」只在本地存用户名，绝不落密码 */
const REMEMBER_KEY = 'lx-remember-username';

const HIGHLIGHTS = [
  { icon: <IconClockCircle />, title: '考勤自动核算', desc: '打卡 · 排班 · 加班调休一体化' },
  { icon: <IconSafe />, title: '薪酬精准发放', desc: '金额按分定点运算，明细可追溯' },
  { icon: <IconCheckCircle />, title: '流程在线审批', desc: '请假 · 报销 · 用印全程留痕' },
];

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { info: systemInfo } = useSystemInfo();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // 每次失败自增，用于重放抖动动画（同一错误连续出现时也能再抖一次）
  const [errorSeq, setErrorSeq] = useState(0);

  // 回填上次记住的账号（仅用户名）
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRemember(true);
      }
    } catch {
      // 隐私模式读不到就跳过，不影响登录
    }
  }, []);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await authApi.login({ username: username.trim(), password });
      if (res.code === 0 && res.data?.user) {
        // 勾选才记住账号；取消勾选要清掉旧值，否则会一直回填
        try {
          if (remember) window.localStorage.setItem(REMEMBER_KEY, username.trim());
          else window.localStorage.removeItem(REMEMBER_KEY);
        } catch {
          // 存储不可用不影响登录
        }
        setUser(res.data.user);
        Message.success('登录成功');
        router.push('/');
      } else {
        setErrorMsg(res.message || '登录失败');
        setErrorSeq((n) => n + 1);
      }
    } catch (e: any) {
      setErrorMsg(e.message || '登录失败');
      setErrorSeq((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lx-login-page flex items-center justify-center relative">
      {/* 深色品牌侧栏（lg 以上显示）：单色深面 + 三条能力点，不做光斑/网格装饰 */}
      <aside className="lx-login-aside hidden lg:flex" aria-hidden="true">
        <div className="lx-login-aside-inner">
          <h2 className="lx-login-slogan">
            让考勤与薪酬
            <br />
            一次算清
          </h2>
          <p className="lx-login-slogan-sub">
            从打卡到发薪，全流程在线协同，数据一处录入、处处一致。
          </p>

          <ul className="lx-login-highlights">
            {HIGHLIGHTS.map((h, i) => (
              <li key={h.title} className="lx-login-highlight" style={{ ['--i' as any]: i }}>
                <span className="lx-login-highlight-ic">{h.icon}</span>
                <span className="lx-login-highlight-text">
                  <strong>{h.title}</strong>
                  <em>{h.desc}</em>
                </span>
              </li>
            ))}
          </ul>

          {/* 工资条样卡：这个产品的世界就是工资单与工时表，一张真实凭证比任何
              插画都只属于它。纯代码绘制（纸色 + 穿孔线 + mono 数字），数据为静态演示值 */}
          <div className="lx-login-payslip">
            <i className="lx-login-payslip-notch left" aria-hidden="true" />
            <i className="lx-login-payslip-notch" aria-hidden="true" />
            <div className="lx-login-payslip-stub">
              <span className="lx-login-payslip-title">十月工资条</span>
              <span className="lx-login-payslip-state">已发放</span>
            </div>
            <dl className="lx-login-payslip-rows">
              <div>
                <dt>基本工资</dt>
                <dd>6,500.00</dd>
              </div>
              <div>
                <dt>加班费</dt>
                <dd>812.50</dd>
              </div>
              <div>
                <dt>应扣合计</dt>
                <dd>-432.00</dd>
              </div>
            </dl>
            <div className="lx-login-payslip-net">
              <span>实发</span>
              <strong>¥6,880.50</strong>
            </div>
          </div>
        </div>

        <div className="lx-login-aside-foot">数据本地部署 · 权限按角色隔离</div>
      </aside>

      {/* 右侧登录区 */}
      <div className="lx-login-main flex flex-col items-center justify-center">
        <div className="lx-login-card relative z-10 w-full max-w-[400px] mx-4 px-6 sm:px-8 py-9 rounded-xl bg-surface">
          <div className="flex flex-col items-center mb-7">
            {systemInfo.logoUrl ? (
              /**
               * 用 next/image 而非原生 <img>：自动写死 width/height，消除首屏布局抖动（CLS）。
               * 用 unoptimized 是因为 Logo 由后台配置，可能是任意 OSS/外链地址，
               * 无法预先列入 images.remotePatterns 白名单（产物仍是同一个 <img>，不影响观感）。
               */
              <Image
                src={systemInfo.logoUrl}
                alt="系统 Logo"
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 object-contain rounded-xl"
              />
            ) : (
              <div className="lx-login-logo flex h-14 w-14 items-center justify-center rounded-xl text-[26px] font-semibold text-white">
                {(systemInfo.name || '雷').charAt(0)}
              </div>
            )}
            <Typography.Title
              heading={1}
              style={{ textAlign: 'center', margin: '16px 0 0', fontWeight: 600, fontSize: 20 }}
            >
              {systemInfo.name}
            </Typography.Title>
            <div className="text-sm text-text-3 text-center mt-1.5">考勤 · 算薪 · 员工管理</div>
          </div>

          {/* lx-form-glow（Galaxy Round 3）：表单内任一输入聚焦时容器亮起，控件级描边见 globals.css scoped 规则 */}
          <Form layout="vertical" className="lx-form-glow" onSubmit={handleSubmit}>
            <Form.Item label="用户名">
              <Input
                size="large"
                placeholder="请输入用户名"
                value={username}
                onChange={setUsername}
                onPressEnter={handleSubmit}
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item label="密码">
              <Input.Password
                size="large"
                placeholder="请输入密码"
                value={password}
                onChange={setPassword}
                onPressEnter={handleSubmit}
                autoComplete="current-password"
              />
            </Form.Item>

            <div className="lx-login-options">
              <Checkbox checked={remember} onChange={setRemember}>
                记住账号
              </Checkbox>
            </div>

            {errorMsg && (
              <Alert
                key={errorSeq}
                className="lx-login-error"
                type="error"
                content={errorMsg}
                style={{ margin: '0 0 16px' }}
              />
            )}

            <Button
              type="primary"
              long
              size="large"
              htmlType="submit"
              loading={loading}
              disabled={!canSubmit}
              style={{ fontWeight: 500 }}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form>

          <div className="lx-login-tip">忘记密码请联系系统管理员重置</div>
        </div>

        <div className="lx-login-copyright relative z-10 mt-7 text-xs text-text-3">
          © 2026 {systemInfo.name}
        </div>
      </div>
    </div>
  );
}
