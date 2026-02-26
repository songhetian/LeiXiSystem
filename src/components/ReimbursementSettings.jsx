/**
 * 报销设置页面
 * 管理报销类型和费用类型
 */
import React, { useState, useEffect } from 'react';
import { 
  Tabs, Table, Button, Input, Modal, Form, 
  Switch, Space, InputNumber
} from 'antd';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  LayoutList, 
  Tag, 
  Settings, 
  Info,
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';

const ReimbursementSettings = () => {
  const [activeTab, setActiveTab] = useState('types');

  return (
    <div className="container mx-auto py-8 max-w-6xl px-4">
      {/* 页面头部 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">报销基础设置</h1>
          <p className="text-sm text-slate-500 mt-1">自定义管理报销单类型以及费用明细项，以适配不同的业务场景</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
          <Settings className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">系统管理模式</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="custom-tabs-shadcn px-6 pt-2"
          items={[
            {
              key: 'types',
              label: (
                <div className="flex items-center gap-2 py-2">
                  <LayoutList className="h-4 w-4" />
                  <span>报销分类 (一级)</span>
                </div>
              ),
              children: <div className="py-6"><ReimbursementTypesManager /></div>
            },
            {
              key: 'expenses',
              label: (
                <div className="flex items-center gap-2 py-2">
                  <Tag className="h-4 w-4" />
                  <span>费用明细 (二级)</span>
                </div>
              ),
              children: <div className="py-6"><ExpenseTypesManager /></div>
            }
          ]}
        />
      </div>
    </div>
  );
};

// =============================================================================
// 子组件：报销类型管理
// =============================================================================
const ReimbursementTypesManager = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reimbursement/types');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      is_active: !!record.is_active
    });
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, sort_order: 0 });
    setModalVisible(true);
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '确认删除分类',
      icon: <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />,
      content: '删除此类型后，旧的报销单将仅显示文本。确定要删除吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      okButtonProps: { className: 'bg-red-500 hover:bg-red-600 border-none h-9 rounded-md' },
      cancelButtonProps: { className: 'h-9 rounded-md' },
      onOk: async () => {
        try {
          await api.delete(`/reimbursement/types/${id}`);
          toast.success('分类已成功移除');
          fetchData();
        } catch (error) {
          toast.error('删除失败，可能该分类正在被使用');
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        is_active: values.is_active ? 1 : 0
      };
      
      if (editingItem) {
        await api.put(`/reimbursement/types/${editingItem.id}`, payload);
        toast.success('配置更新成功');
      } else {
        await api.post('/reimbursement/types', payload);
        toast.success('新分类已创建');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {}
  };

  const columns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="font-semibold text-slate-800">{text}</span>
    },
    {
      title: '描述说明',
      dataIndex: 'description',
      key: 'description',
      render: (text) => <span className="text-slate-500 text-sm">{text || '--'}</span>
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active, record) => (
        <Switch 
          checked={!!active} 
          size="small"
          className={active ? 'bg-primary' : ''}
          onChange={async (checked) => {
            try {
              await api.put(`/reimbursement/types/${record.id}`, { ...record, is_active: checked ? 1 : 0 });
              fetchData();
            } catch (e) { toast.error('修改状态失败'); }
          }} 
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <div className="flex justify-end gap-1">
          <button 
            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-all"
            onClick={() => handleEdit(record)}
            title="编辑"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button 
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
            onClick={() => handleDelete(record.id)}
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center px-6 mb-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Info className="h-4 w-4" />
          <span className="text-xs">定义报销单的大类，如“差旅申请”、“日常报销”等</span>
        </div>
        <button 
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" /> 新增分类
        </button>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={false}
        className="shadcn-table"
      />

      <Modal
        title={<span className="text-lg font-bold">{editingItem ? '编辑报销分类' : '新增报销分类'}</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        destroyOnHidden
        centered
        width={400}
        okText="保存配置"
        cancelText="取消"
        okButtonProps={{ className: 'bg-primary h-10 rounded-md shadow-none border-none' }}
        cancelButtonProps={{ className: 'h-10 rounded-md' }}
      >
        <Form form={form} layout="vertical" className="mt-6">
          <Form.Item name="name" label={<span className="text-sm font-medium">分类名称</span>} rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="如：差旅报销、办公用品" className="h-10" />
          </Form.Item>
          <Form.Item name="description" label={<span className="text-sm font-medium">描述说明</span>}>
            <Input.TextArea rows={3} placeholder="简要说明此报销分类的适用范围" className="resize-none" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="sort_order" label={<span className="text-sm font-medium">排序权重</span>}>
              <InputNumber min={0} className="w-full h-10 flex items-center" />
            </Form.Item>
            <Form.Item name="is_active" label={<span className="text-sm font-medium">当前状态</span>} valuePropName="checked">
              <div className="h-10 flex items-center">
                <Switch checkedChildren="已开启" unCheckedChildren="已关闭" className="bg-slate-200" />
              </div>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

// =============================================================================
// 子组件：费用类型管理
// =============================================================================
const ExpenseTypesManager = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reimbursement/expense-types');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      is_active: !!record.is_active
    });
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, sort_order: 0 });
    setModalVisible(true);
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '确认删除费用项',
      icon: <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />,
      content: '确定要移除此费用明细项吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      okButtonProps: { className: 'bg-red-500 hover:bg-red-600 border-none h-9 rounded-md' },
      onOk: async () => {
        try {
          await api.delete(`/reimbursement/expense-types/${id}`);
          toast.success('费用项已删除');
          fetchData();
        } catch (error) {
          toast.error('删除失败');
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        is_active: values.is_active ? 1 : 0
      };
      
      if (editingItem) {
        await api.put(`/reimbursement/expense-types/${editingItem.id}`, payload);
        toast.success('费用项更新成功');
      } else {
        await api.post('/reimbursement/expense-types', payload);
        toast.success('新费用项已添加');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {}
  };

  const columns = [
    {
      title: '费用项名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="font-semibold text-slate-800">{text}</span>
    },
    {
      title: '报销单位',
      dataIndex: 'unit',
      key: 'unit',
      render: (text) => <span className="text-slate-500">{text || '--'}</span>
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active, record) => (
        <Switch 
          checked={!!active} 
          size="small"
          className={active ? 'bg-primary' : ''}
          onChange={async (checked) => {
            try {
              await api.put(`/reimbursement/expense-types/${record.id}`, { ...record, is_active: checked ? 1 : 0 });
              fetchData();
            } catch (e) { toast.error('修改状态失败'); }
          }} 
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <div className="flex justify-end gap-1">
          <button 
            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-all"
            onClick={() => handleEdit(record)}
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button 
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
            onClick={() => handleDelete(record.id)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center px-6 mb-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Info className="h-4 w-4" />
          <span className="text-xs">定义具体费用明细，如“市内交通费”、“招待餐费”等</span>
        </div>
        <button 
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" /> 新增费用项
        </button>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={false}
        className="shadcn-table"
      />

      <Modal
        title={<span className="text-lg font-bold">{editingItem ? '编辑费用类型' : '新增费用类型'}</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        destroyOnHidden
        centered
        width={400}
        okText="保存配置"
        cancelText="取消"
        okButtonProps={{ className: 'bg-primary h-10 rounded-md border-none shadow-none' }}
        cancelButtonProps={{ className: 'h-10 rounded-md' }}
      >
        <Form form={form} layout="vertical" className="mt-6">
          <Form.Item name="name" label={<span className="text-sm font-medium">费用项名称</span>} rules={[{ required: true, message: '请输入费用项名称' }]}>
            <Input placeholder="如：火车票、滴滴打车" className="h-10" />
          </Form.Item>
          <Form.Item name="unit" label={<span className="text-sm font-medium">报销单位</span>} extra="如：张、次、天（可选）">
            <Input placeholder="如：张" className="h-10" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="sort_order" label={<span className="text-sm font-medium">排序权重</span>}>
              <InputNumber min={0} className="w-full h-10 flex items-center" />
            </Form.Item>
            <Form.Item name="is_active" label={<span className="text-sm font-medium">当前状态</span>} valuePropName="checked">
              <div className="h-10 flex items-center">
                <Switch checkedChildren="已开启" unCheckedChildren="已关闭" className="bg-slate-200" />
              </div>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ReimbursementSettings;