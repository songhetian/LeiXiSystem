'use client';

import { useState, useEffect } from 'react';
import {
  Message,
  Modal,
  Space,
  Button,
  Form,
  Input,
  Select,
  Tree,
  Tabs,
  Empty,
  Popconfirm,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { systemApi, SysDepartment, SysPosition } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

const { TabPane } = Tabs;

export default function SystemDepartmentsPage() {
  const { can } = usePermission();

  return (
    <PageContainer title="组织架构">
      <Tabs defaultActiveTab="department">
        <TabPane key="department" title="部门管理">
          <DepartmentTree />
        </TabPane>
        <TabPane key="position" title="岗位管理">
          <PositionList />
        </TabPane>
      </Tabs>
    </PageContainer>
  );
}

// ====== 部门管理 ======
function DepartmentTree() {
  const { can } = usePermission();
  const { data: departments, loading, error, run: runFetch, setData: setDepartments } = useFetchState<SysDepartment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [createVisible, setCreateVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [editItem, setEditItem] = useState<SysDepartment | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  const fetchData = async () => {
    await runFetch(async () => {
      const res = await systemApi.listDepartments();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取部门列表失败');
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const treeData = buildTree(departments || []);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    setCreateVisible(true);
  };

  const openEdit = (item: SysDepartment) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({ name: item.name, parentId: item.parentId });
    setEditVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await systemApi.updateDepartment(editItem.id, values as any);
        if (res.code === 0) {
          Message.success('更新成功');
          setEditVisible(false);
          fetchData();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await systemApi.createDepartment(values as any);
        if (res.code === 0) {
          Message.success('创建成功');
          setCreateVisible(false);
          fetchData();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: SysDepartment) => {
    try {
      const res = await systemApi.deleteDepartment(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        fetchData();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  const parentOptions = (departments || [])
    .filter((d) => !editItem || d.id !== editItem.id)
    .map((d) => ({ label: d.name, value: d.id }));

  return (
    <div className="flex gap-4 min-h-[400px]">
      <div className="w-80 bg-bg-secondary rounded-md p-4 border border-border-2">
        <div className="mb-3 flex justify-between items-center">
          <span className="font-medium text-text-1">部门列表</span>
          <Button type="primary" size="small" onClick={openCreate}>
            新增部门
          </Button>
        </div>
        <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={!departments || departments.length === 0}>
          <Tree
            treeData={treeData}
            onSelect={(keys) => {
              if (keys && keys.length > 0) {
                setSelectedId(Number(keys[0]));
              } else {
                setSelectedId(null);
              }
            }}
          />
        </DataState>
      </div>

      <div className="flex-1">
        {selectedId ? (
          <div className="p-6 bg-bg-secondary rounded-md border border-border-2">
            <div className="mb-4 flex justify-between">
              <h3 className="m-0">
                {(departments || []).find((d) => d.id === selectedId)?.name}
              </h3>
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    const dept = (departments || []).find((d) => d.id === selectedId);
                    if (dept) openEdit(dept);
                  }}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除该部门？"
                  content="删除后不可恢复"
                  onOk={() => {
                    const dept = (departments || []).find((d) => d.id === selectedId);
                    if (dept) handleDelete(dept);
                  }}
                >
                  <Button size="small" status="danger">
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </div>
            <div className="text-text-3">
              <div>部门 ID：{selectedId}</div>
              <div className="mt-2">
                上级部门：                {(departments || []).find((d) => d.id === selectedId)?.parentId
                  ? (departments || []).find(
                      (d) => d.id === (departments || []).find((x) => x.id === selectedId)?.parentId,
                    )?.name || '-'
                  : '无（顶级部门）'}
              </div>
            </div>
          </div>
        ) : (
          <Empty description="请选择部门查看详情" />
        )}
      </div>

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
            <Select
              placeholder="请选择上级部门（不选为顶级部门）"
              allowClear
              options={parentOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ====== 岗位列表 ======
function PositionList() {
  const { data: list, loading, error, run: runFetch, setData: setList } = useFetchState<SysPosition[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<SysPosition | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    await runFetch(async () => {
      const res = await systemApi.listPositions();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取岗位列表失败');
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEdit = (item: SysPosition) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({ name: item.name });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await systemApi.updatePosition(editItem.id, values);
        if (res.code === 0) {
          Message.success('更新成功');
          setModalVisible(false);
          fetchData();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await systemApi.createPosition(values);
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          fetchData();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: SysPosition) => {
    try {
      const res = await systemApi.deletePosition(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        fetchData();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  return (
    <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
      <div className="mb-4 flex justify-between">
        <span className="font-medium text-text-1">岗位列表</span>
        <Button type="primary" size="small" onClick={openCreate}>
          新增岗位
        </Button>
      </div>
      <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={!list || list.length === 0}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-2">
              <th className="text-left py-2.5 px-3">ID</th>
              <th className="text-left py-2.5 px-3">岗位名称</th>
              <th className="text-right py-2.5 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {(list || []).map((item) => (
              <tr key={item.id} className="border-b border-border-2">
                <td className="py-2.5 px-3">{item.id}</td>
                <td className="py-2.5 px-3">{item.name}</td>
                <td className="py-2.5 px-3 text-right">
                  <Space>
                    <Button size="mini" onClick={() => openEdit(item)}>
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定删除吗？"
                      onOk={() => handleDelete(item)}
                    >
                      <Button size="mini" status="danger">
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>

      <Modal
        title={isEdit ? '编辑岗位' : '新增岗位'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="岗位名称" field="name" rules={[{ required: true, message: '请输入岗位名称' }]}>
            <Input placeholder="请输入岗位名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ====== 工具函数 ======
function buildTree(list: SysDepartment[]): any[] {
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
