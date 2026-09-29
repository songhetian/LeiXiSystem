'use client';

import { useState, useMemo } from 'react';
import {
  Message,
  Modal,
  Space,
  Button,
  Form,
  Input,
  Select,
  Tabs,
  Empty,
  Table,
  Switch,
  Tag,
  Checkbox,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { systemApi, SysDepartment } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';
import { formatDate } from '@/lib/format';
import { PositionList } from './positions';

const { TabPane } = Tabs;
const { TextArea } = Input;

export default function SystemDepartmentsPage() {
  return (
    <PageContainer >
      <Tabs defaultActiveTab="department">
        <TabPane key="department" title="部门管理">
          <DepartmentManager />
        </TabPane>
        <TabPane key="position" title="岗位管理">
          <PositionList />
        </TabPane>
      </Tabs>
    </PageContainer>
  );
}

// ====== 部门管理（描述 / 启停 / 回收站 / 恢复）======
function DepartmentManager() {
  const { can } = usePermission();
  const [showDeleted, setShowDeleted] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<SysDepartment | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // SWR 共享缓存：以 showDeleted 编入 cacheKey，切换显示回收站时自动复用历史缓存/重新请求
  const cacheKey = `system:departments:${showDeleted}`;
  const fetcher = useMemo(
    () => () =>
      systemApi.listDepartments(showDeleted).then((res) => {
        if (res.code === 0 && res.data) return res.data;
        throw new Error(res.message || '获取部门列表失败');
      }),
    [showDeleted],
  );
  const { data: list, loading, error, revalidate } = useCachedData<SysDepartment[]>(cacheKey, fetcher, {
    staleTime: 30_000,
  });

  const activeList = (list || []).filter((d) => !d.deletedAt);
  const recycleList = (list || []).filter((d) => d.deletedAt);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    setCreateVisible(true);
  };

  const openEdit = (item: SysDepartment) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({ name: item.name, parentId: item.parentId, description: item.description || '' });
    setEditVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await systemApi.updateDepartment(editItem.id, {
          name: values.name,
          parentId: values.parentId ?? null,
          description: values.description || '',
        });
        if (res.code === 0) {
          Message.success('更新成功');
          setEditVisible(false);
          revalidate();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await systemApi.createDepartment({
          name: values.name,
          parentId: values.parentId,
          description: values.description || '',
        });
        if (res.code === 0) {
          Message.success('创建成功');
          setCreateVisible(false);
          revalidate();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      notifyError(e, '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 启停部门（同步所属员工状态由后端/历史沿用，此处仅更新部门状态）
  const handleStatusToggle = (dept: SysDepartment, next: boolean) => {
    const action = next ? '启用' : '停用';
    Modal.confirm({
      title: `${action}部门`,
      content: `确定要${action}部门「${dept.name}」吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await systemApi.updateDepartment(dept.id, { status: next ? 'active' : 'inactive' });
          if (res.code === 0) {
            Message.success(`部门已${action}`);
            revalidate();
          } else {
            Message.error(res.message || '操作失败');
          }
        } catch (e) {
          notifyError(e, '操作失败');
        }
      },
    });
  };

  const handleDelete = (dept: SysDepartment) => {
    Modal.confirm({
      title: '移入回收站',
      content: `确定将部门「${dept.name}」移入回收站吗？删除后可随时恢复。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await systemApi.deleteDepartment(dept.id);
          if (res.code === 0) {
            Message.success('已移至回收站');
            revalidate();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e) {
          notifyError(e, '删除失败');
        }
      },
    });
  };

  const handleRestore = (dept: SysDepartment) => {
    Modal.confirm({
      title: '恢复部门',
      content: `确定要恢复部门「${dept.name}」吗？恢复后部门将重新投入使用。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await systemApi.restoreDepartment(dept.id);
          if (res.code === 0) {
            Message.success('部门已恢复');
            revalidate();
          } else {
            Message.error(res.message || '恢复失败');
          }
        } catch (e) {
          notifyError(e, '恢复失败');
        }
      },
    });
  };

  const parentOptions = (activeList)
    .filter((d) => !editItem || d.id !== editItem.id)
    .map((d) => ({ label: d.name, value: d.id }));

  const columns = [
    {
      title: '部门名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '职责描述',
      dataIndex: 'description',
      render: (v: string | null) => v || '-',
    },
    {
      title: '在册人数',
      dataIndex: 'employeeCount',
      width: 100,
      render: (v: number) => (v == null ? 0 : v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_: any, row: SysDepartment) => {
        if (row.deletedAt) {
          return <Tag color="red">已销毁</Tag>;
        }
        return (
          <Switch
            size="small"
            checked={row.status === 'active'}
            checkedText="启用"
            uncheckedText="停用"
            onChange={(checked) => handleStatusToggle(row, Boolean(checked))}
          />
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 170,
      render: (_: any, row: SysDepartment) => {
        if (row.deletedAt) {
          return (
            <Button size="mini" type="text" status="success" onClick={() => handleRestore(row)}>
              恢复
            </Button>
          );
        }
        return (
          <Space>
            <Button size="mini" type="text" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Button size="mini" type="text" status="danger" onClick={() => handleDelete(row)}>
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between bg-bg-secondary rounded-md p-4 border border-border-2">
        <div className="flex items-center gap-6 text-sm text-text-1">
          <span>
            活跃部门：<span className="text-text-1 font-medium">{activeList.length}</span>
          </span>
          <Checkbox checked={showDeleted} onChange={setShowDeleted}>
            显示回收站（已删除）
          </Checkbox>
        </div>
        {can('department:manage') && (
          <Button type="primary" onClick={openCreate}>
            新增部门
          </Button>
        )}
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={revalidate}
        isEmpty={!list || list.length === 0}
      >
        {showDeleted && recycleList.length === 0 ? (
          <Empty description="回收站暂无已删除部门" />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            data={showDeleted ? recycleList : activeList}
            pagination={false}
            scroll={{ x: 900 }}
          />
        )}
      </DataState>

      <Modal
        title={isEdit ? '编辑部门' : '新增部门'}
        visible={isEdit ? editVisible : createVisible}
        onOk={handleSubmit}
        onCancel={() => {
          isEdit ? setEditVisible(false) : setCreateVisible(false);
        }}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="部门名称" field="name" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item label="上级部门" field="parentId">
            <Select placeholder="不选则为顶级部门" allowClear options={parentOptions} />
          </Form.Item>
          <Form.Item label="职责描述" field="description">
            <TextArea placeholder="请输入部门主要职责描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ====== 工具函数 ======
export function buildTree(list: SysDepartment[]): any[] {
  const map = new Map<number, any>();
  list.forEach((item) => {
    map.set(item.id, { key: item.id, title: item.name, children: [] });
  });
  const roots: any[] = [];
  list.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}