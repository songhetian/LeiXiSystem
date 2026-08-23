'use client';

import { useState, useEffect, useCallback } from 'react';
import { Message, Modal, Button, Input, Spin, Empty } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import { employeeTagApi, EmployeeTag, EmployeeTagCreateDto, EmployeeTagUpdateDto } from '@/services/employee';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

/** 默认标签色（供新建时随机取色） */
const VIBRANT_COLORS = [
  '#3B82F6', '#16A34A', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
  '#EC4899', '#F97316', '#10B981', '#6366F1', '#DC2626', '#2563EB',
];

export default function TagsPage() {
  const { can } = usePermission();
  const canManage = can('employee:tag:manage');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<EmployeeTag[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingTag, setEditingTag] = useState<EmployeeTag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeeTagApi.list();
      if (res.code === 0 && res.data) {
        setTags(res.data.list);
      } else {
        setError(res.message || '获取标签列表失败');
        Message.error(res.message || '获取标签列表失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取标签列表失败');
      notifyError(e, '获取标签列表失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAdd = () => {
    if (!canManage) return;
    setEditingTag(null);
    setName('');
    setColor(VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)]);
    setSortOrder('');
    setModalVisible(true);
  };

  const handleEdit = (record: EmployeeTag) => {
    if (!canManage) return;
    setEditingTag(record);
    setName(record.name);
    setColor(record.color || '');
    setSortOrder(String(record.sortOrder ?? 0));
    setModalVisible(true);
  };

  const handleDelete = (record: EmployeeTag) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除标签「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await employeeTagApi.remove(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchList();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e: any) {
          notifyError(e, '删除失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    if (!name.trim()) {
      Message.warning('请填写标签名称');
      return;
    }
    setModalLoading(true);
    try {
      const dto: EmployeeTagCreateDto | EmployeeTagUpdateDto = {
        name: name.trim(),
        color: color.trim() || undefined,
        sortOrder: sortOrder === '' ? undefined : Number(sortOrder),
      };
      let res;
      if (editingTag) {
        res = await employeeTagApi.update(editingTag.id, dto);
      } else {
        res = await employeeTagApi.create(dto as EmployeeTagCreateDto);
      }
      if (res.code === 0) {
        Message.success(editingTag ? '修改成功' : '创建成功');
        setModalVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      notifyError(e, '操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExport = () => {
    if (!exportToExcel(
      `员工标签_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '员工标签',
      [
        { title: '标签名称', dataIndex: 'name' },
        { title: '颜色', value: (t: EmployeeTag) => t.color || '' },
        { title: '排序', value: (t: EmployeeTag) => t.sortOrder },
      ],
      tags,
    )) {
      Message.info('当前没有可导出的标签数据');
    }
  };

  return (
    <PageContainer title="员工标签" breadcrumbs={['首页', '员工管理', '员工标签']}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {tags.length} 个标签</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" disabled={!canManage} onClick={handleAdd}>+ 新建标签</Button>
        </div>
      </div>

      <Spin loading={loading} style={{ display: 'block' }}>
        {error ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
            <p className="text-text-3 mb-3">{error}</p>
            <Button onClick={() => fetchList()}>重试</Button>
          </div>
        ) : tags.length === 0 ? (
          <div className="py-16 bg-surface border border-border-1 rounded-md">
            <Empty description="暂无标签，点击右上角新建标签" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => {
              const c = tag.color || '#3B82F6';
              return (
                <div
                  key={tag.id}
                  className="bg-surface border border-border-1 rounded-md p-5 flex items-center justify-between transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="shrink-0 w-4 h-4 rounded-full"
                      style={{ background: c, border: '1px solid rgba(0,0,0,0.08)' }}
                      title={c}
                    />
                    <div>
                      <div className="text-text-1 font-medium">{tag.name}</div>
                      <div className="text-xs text-text-3 mt-0.5">排序：{tag.sortOrder ?? 0}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="small" type="text" disabled={!canManage} onClick={() => handleEdit(tag)}>编辑</Button>
                    <Button size="small" type="text" status="danger" disabled={!canManage} onClick={() => handleDelete(tag)}>删除</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={modalLoading}
        okText="确定"
        cancelText="取消"
        style={{ width: 480 }}
        maskClosable={false}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm text-text-2 mb-1.5">标签名称</label>
            <Input
              value={name}
              onChange={(v) => setName(v)}
              placeholder="请输入标签名称"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">颜色</label>
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {VIBRANT_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: c,
                      cursor: 'pointer',
                      border: color.toLowerCase() === c.toLowerCase() ? '2px solid #2455D9' : '1px solid rgba(0,0,0,0.12)',
                      outline: 'none',
                    }}
                  />
                ))}
              </div>
              <Input
                value={color}
                onChange={(v) => setColor(v)}
                placeholder="颜色代码，如 4f6ef7"
                maxLength={20}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">排序</label>
            <Input
              value={sortOrder}
              onChange={(v) => setSortOrder(v.replace(/[^\d]/g, ''))}
              placeholder="排序值，越小越靠前，默认 0"
              type="number"
            />
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}