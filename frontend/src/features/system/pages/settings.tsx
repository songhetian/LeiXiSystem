'use client';

import { useState, useEffect, useMemo } from 'react';
import { Message, Card, Input, Button, Space, Spin } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import { settingsApi, SystemSetting } from '@/services/settings';

const GROUP_LABELS: Record<string, string> = {
  general: '基础信息',
  attendance: '考勤设置',
  security: '安全策略',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  const grouped = useMemo(() => {
    const map: Record<string, SystemSetting[]> = {};
    for (const s of settings) {
      (map[s.group] ||= []).push(s);
    }
    return map;
  }, [settings]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.list();
      if (res.code === 0 && res.data) {
        setSettings(res.data);
        setValues(Object.fromEntries(res.data.map((s) => [s.key, s.value])));
      } else {
        Message.error(res.message || '加载设置失败');
      }
    } catch (e) {
      Message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const changed = settings
      .filter((s) => values[s.key] !== s.value)
      .map((s) => ({ key: s.key, value: values[s.key] }));
    if (changed.length === 0) {
      Message.info('没有需要保存的更改');
      return;
    }
    setSaving(true);
    try {
      const res = await settingsApi.bulkUpdate(changed);
      if (res.code === 0) {
        Message.success('保存成功');
        await fetchAll();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="系统设置" activeMenu="settings">
      <PageContainer
        title="系统设置"
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存更改
          </Button>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {Object.entries(grouped).map(([group, items]) => (
              <Card key={group} title={GROUP_LABELS[group] || group}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {items.map((s) => (
                    <div key={s.key}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>{s.label || s.key}</span>
                        {s.description && (
                          <div style={{ fontSize: 12, color: '#86909c' }}>{s.description}</div>
                        )}
                      </div>
                      <Input
                        value={values[s.key] ?? ''}
                        onChange={(v) => handleChange(s.key, v)}
                        placeholder={s.label || s.key}
                        style={{ maxWidth: 480 }}
                      />
                    </div>
                  ))}
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </PageContainer>
    </AppLayout>
  );
}
