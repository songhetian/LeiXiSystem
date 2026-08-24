'use client';

import { useState, useEffect } from 'react';
import { Message, Card, Tag, Space, Typography, Empty } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { systemApi, SysPermission, SysRole } from '@/services/system';
import { groupPermissionsByModule } from '../permission-utils';

const { Text } = Typography;

// 权限目录查看页：按模块分组展示全部权限点，并露出每个权限被多少个角色引用（便于看清权限分布）。
// 权限点的增删改不在此页（权限为种子数据），角色↔权限分配保留在「角色权限」页的分配弹窗。
export default function SystemPermissionsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<SysPermission[]>([]);
  const [roles, setRoles] = useState<SysRole[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, rRes] = await Promise.all([
        systemApi.listPermissions(),
        systemApi.listRoles(),
      ]);
      if (pRes.code === 0 && pRes.data) setPermissions(pRes.data);
      else throw new Error(pRes.message || '获取权限失败');
      if (rRes.code === 0 && rRes.data) setRoles(rRes.data);
    } catch (e: any) {
      setError(e?.message || '获取权限失败');
      Message.error(e?.message || '获取权限失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 权限 ID -> 引用它的角色数
  const roleCountById = new Map<number, number>();
  roles.forEach((role) => {
    (role.permissions || []).forEach(({ permission }) => {
      roleCountById.set(permission.id, (roleCountById.get(permission.id) || 0) + 1);
    });
  });

  const grouped = groupPermissionsByModule(permissions);

  return (
    <PageContainer title="权限管理">
      <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={permissions.length === 0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {Object.entries(grouped).map(([module, perms]) => (
            <Card key={module} size="small">
              <div style={{ marginBottom: 12 }}>
                <Text bold style={{ fontSize: 14 }}>{module}</Text>
                <Tag color="arcoblue" style={{ marginLeft: 8 }}>{perms.length} 项</Tag>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {perms.map((p) => {
                  const count = roleCountById.get(p.id) || 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--lx-bg-2)',
                      }}
                    >
                      <Space size={8}>
                        <Text>{p.name}</Text>
                        <Text style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>{p.code}</Text>
                      </Space>
                      <Tag size="small" color={count > 0 ? 'green' : 'gray'}>
                        {count > 0 ? `${count} 个角色` : '未使用'}
                      </Tag>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </DataState>
    </PageContainer>
  );
}