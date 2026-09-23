'use client';

import { Card, Tag, Space, Typography } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { systemApi, SysPermission, SysRole } from '@/services/system';
import { useCachedData } from '@/hooks/use-cached-data';
import { groupPermissionsByModule, moduleLabel } from '../permission-utils';

const { Text } = Typography;

// 权限目录查看页：按模块分组展示全部权限点，并露出每个权限被多少个角色引用（便于看清权限分布）。
// 权限点的增删改不在此页（权限为种子数据），角色↔权限分配保留在「角色权限」页的分配弹窗。
export default function SystemPermissionsPage() {
  // SWR 缓存：与「角色权限」页共享 permissions/roles 参考数据
  const { data: pRes, loading: pLoading, error, revalidate } = useCachedData<{
    code: number;
    message?: string;
    data?: SysPermission[];
  }>('system:permissions', () => systemApi.listPermissions(), { staleTime: 30_000 });
  const permissions = pRes?.code === 0 && pRes.data ? pRes.data : [];

  const { data: rRes, loading: rLoading } = useCachedData<{ code: number; data?: SysRole[] }>(
    'system:roles',
    () => systemApi.listRoles(),
    { staleTime: 30_000 },
  );
  const roles = rRes?.code === 0 && rRes.data ? rRes.data : [];

  const loading = pLoading || rLoading;

  // 权限 ID -> 引用它的角色数
  const roleCountById = new Map<number, number>();
  roles.forEach((role) => {
    (role.permissions || []).forEach(({ permission }) => {
      roleCountById.set(permission.id, (roleCountById.get(permission.id) || 0) + 1);
    });
  });

  const grouped = groupPermissionsByModule(permissions);

  return (
    <PageContainer >
      <DataState loading={loading} error={error} onRetry={revalidate} isEmpty={permissions.length === 0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {Object.entries(grouped).map(([module, perms]) => (
            <Card key={module} size="small">
              <div style={{ marginBottom: 12 }}>
                <Text bold style={{ fontSize: 14 }}>{moduleLabel(module)}</Text>
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