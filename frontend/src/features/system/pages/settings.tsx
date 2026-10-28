'use client';

import { useState, useEffect, useMemo } from 'react';
import { Message, Card, Input, Button, Space, Upload } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { settingsApi, SystemSetting } from '@/services/settings';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { useSystemInfo } from '@/hooks/use-system-info';

const GROUP_LABELS: Record<string, string> = {
  general: '基础信息',
  attendance: '考勤设置',
  security: '安全策略',
};

/**
 * 相对 /uploads 路径 → 可访问预览地址，供 Logo 预览用。
 * 与报销附件保持一致的口径；此处刻意走带鉴权的 /files/serve，
 * 因为预览的是「刚上传但尚未保存」的 Logo，公开端点此时还读不到。
 */
function resolveFileUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `/api/v1/files/serve?path=${encodeURIComponent(url)}`;
}

const DEFAULT_SYSTEM_NAME = '雷犀管理系统';

/**
 * 考勤组中真正被后端业务消费的配置项（打卡/签退判定）。
 * 其余 `attendance.*` 仅为预留注册，UI 层面不展示，避免堆叠无效项。
 */
const ACTIVE_ATTENDANCE_KEYS = new Set([
  'attendance.late_threshold', // 迟到阈值(分钟)
  'attendance.early_threshold', // 早退阈值(分钟)
  'attendance.early_clock_in_minutes', // 提前打卡窗口(分钟)
]);

export default function SettingsPage() {
  const { can } = usePermission();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  // 品牌信息独立状态（系统名称 / Logo），不依赖数据库已有记录，保存时 upsert 创建
  const [brandName, setBrandName] = useState(DEFAULT_SYSTEM_NAME);
  const [brandLogo, setBrandLogo] = useState('');

  // SWR 缓存：禁用聚焦自动刷新，避免打断用户正在编辑的表单值
  const cacheKey = `system:settings`;
  const { data: res, loading, error, revalidate } = useCachedData<{
    code: number;
    message?: string;
    data?: SystemSetting[];
  }>(cacheKey, async () => {
    const envelope = await settingsApi.list();
    // 业务码非 0 视为失败：否则页面会退化成「暂无系统设置项」，
    // 用户根本看不出是后端拒绝/出错
    if (envelope.code !== 0) throw new Error(envelope.message || '系统设置读取失败');
    return envelope;
  }, { staleTime: 30_000, revalidateOnFocus: false });
  const settings = res?.code === 0 && res.data ? res.data : [];

  // 系统品牌配置公开信息（名称/Logo），供本页展示（与登录页/侧边栏一致）
  const { info: systemInfo, revalidate: revalidateSystemInfo } = useSystemInfo();

  const grouped = useMemo(() => {
    const map: Record<string, SystemSetting[]> = {};
    for (const s of settings) {
      (map[s.group] ||= []).push(s);
    }
    return map;
  }, [settings]);

  // 服务端数据就绪（首载或保存后 revalidate）时初始化表单值；
  // 依赖服务端 res 引用（缓存内稳定），避免空数组字面量每次渲染生成新引用而触发死循环
  useEffect(() => {
    if (!res || res.code !== 0 || !res.data) return;
    setValues(Object.fromEntries(res.data.map((s) => [s.key, s.value])));
  }, [res]);

  // 品牌名称/Logo 初始化：优先系统设置库，回退公开信息与默认值
  useEffect(() => {
    setBrandName(values['system.name'] ?? systemInfo.name ?? DEFAULT_SYSTEM_NAME);
  }, [values['system.name'], systemInfo.name]);
  useEffect(() => {
    setBrandLogo(values['system.logo'] ?? '');
  }, [values['system.logo']]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleUploadLogo = async (file: File) => {
    try {
      const res = await settingsApi.uploadLogo(file);
      if (res.code === 0 && res.data?.url) {
        setBrandLogo(res.data.url);
        Message.success('Logo 上传成功');
      } else {
        Message.error('Logo 上传失败');
      }
    } catch {
      Message.error('Logo 上传失败');
    }
    return false; // 阻止默认立即上传，由本函数统一处理
  };

  const handleSave = async () => {
    const changed = settings
      .filter((s) => values[s.key] !== s.value)
      .map((s) => ({ key: s.key, value: values[s.key] }));

    // 品牌配置即使不在 settings 列表中也提交（bulkUpdate 自带 upsert 创建）
    const brandNameValue = brandName.trim() || DEFAULT_SYSTEM_NAME;
    const brandLogoValue = brandLogo.trim();
    const brandItems = [
      { key: 'system.name', value: brandNameValue },
      { key: 'system.logo', value: brandLogoValue },
    ];

    // 普通项无变化且品牌项与库中值一致 → 无实际改动可提交
    if (
      changed.length === 0 &&
      (values['system.name'] ?? DEFAULT_SYSTEM_NAME) === brandNameValue &&
      (values['system.logo'] ?? '') === brandLogoValue
    ) {
      Message.info('没有需要保存的更改');
      return;
    }

    const merged = [...changed, ...brandItems];

    setSaving(true);
    try {
      const res = await settingsApi.bulkUpdate(merged);
      if (res.code === 0) {
        Message.success('保存成功');
        revalidate();
        // 强制刷新 system:public:info 共享缓存，让标签页标题 / 侧边栏随后读到新值
        await revalidateSystemInfo();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch {
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer extra={
        <Button
          type="primary"
          loading={saving}
          onClick={handleSave}
          disabled={!can('system:setting:update')}
        >
          保存更改
        </Button>
      }
    >
      {/* 品牌卡片不依赖设置列表数据：加载中/失败时同样可编辑（bulkUpdate 自带 upsert） */}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 品牌信息：系统名称 + Logo（登录页与侧边栏展示） */}
          <Card title="系统品牌" className="lx-settings-brand">
            <div className="lx-brand-row">
              {/* Logo 图标（当前效果） */}
              <div className="lx-brand-logo">
                {brandLogo ? (
                  <img src={resolveFileUrl(brandLogo)} alt="Logo" className="lx-brand-logo-img" />
                ) : (
                  <span>{(brandName || '雷').charAt(0)}</span>
                )}
              </div>

              {/* 名称：登录页 / 侧边栏标题 */}
              <div className="lx-brand-name">
                <div className="lx-brand-name-tip">登录页 / 侧边栏标题</div>
                <Input
                  value={brandName}
                  onChange={setBrandName}
                  placeholder="请输入系统名称"
                  style={{ maxWidth: 320 }}
                />
              </div>

              {/* Logo 上传 */}
              <div className="lx-brand-upload">
                <div className="lx-brand-name-tip">系统 Logo</div>
                <Space size={12}>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={handleUploadLogo}
                    disabled={!can('system:setting:update')}
                  >
                    <Button>上传 Logo</Button>
                  </Upload>
                  {brandLogo && (
                    <Button type="text" onClick={() => setBrandLogo('')}>
                      移除
                    </Button>
                  )}
                </Space>
              </div>
            </div>
          </Card>

          {/* 分组设置项：库中无任何设置项时，品牌卡片仍可编辑（bulkUpdate 自带 upsert 创建） */}
          <DataState loading={loading} error={error} onRetry={revalidate}>
            <>
              {settings.length === 0 && (
                <Card>
                  <div className="lx-settings-empty">暂无系统设置项</div>
                </Card>
              )}

              {Object.entries(grouped).map(([group, items]) => {
                if (items.length === 0) return null;
                let visible = items;
                if (group === 'attendance') {
                  visible = items.filter((s) => ACTIVE_ATTENDANCE_KEYS.has(s.key));
                  if (visible.length === 0) return null;
                }
                return (
                  <Card key={group} title={GROUP_LABELS[group] || group}>
                    <div className="lx-settings-grid">
                      {visible
                        .filter((s) => s.key !== 'system.name' && s.key !== 'system.logo')
                        .map((s) => (
                          <div key={s.key} className="lx-settings-grid-item">
                            <div className="lx-settings-grid-label">
                              <span>{s.label || s.key}</span>
                              {s.description && (
                                <div className="lx-settings-grid-desc">{s.description}</div>
                              )}
                            </div>
                            <div className="lx-settings-grid-control">
                              <Input
                                value={values[s.key] ?? ''}
                                onChange={(v) => handleChange(s.key, v)}
                                placeholder={s.label || s.key}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                );
              })}
            </>
          </DataState>
      </Space>
    </PageContainer>
  );
}
