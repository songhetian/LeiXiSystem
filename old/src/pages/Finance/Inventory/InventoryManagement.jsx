import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Select, Tag, Modal, Form, 
  InputNumber, DatePicker, message, Card, Tabs, Statistic, Row, Col, Alert
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, ShoppingCartOutlined, 
  ExportOutlined, ScanOutlined, HistoryOutlined, WarningOutlined 
} from '@ant-design/icons';
import { apiGet, apiPost } from '../../../utils/apiClient';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Option } = Select;

const InventoryManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  
  // Modals
  const [isProcureModalOpen, setIsProcureModalOpen] = useState(false);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [currentItem, setCurrentItem] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyType, setHistoryType] = useState('usage');

  const [procureForm] = Form.useForm();
  const [useForm] = Form.useForm();
  const [auditForm] = Form.useForm();

  useEffect(() => {
    fetchItems();
  }, [keyword]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/inventory/items?keyword=${keyword}`);
      if (res.success) setItems(res.data);
    } catch (err) {
      message.error('加载库存失败');
    } finally {
      setLoading(false);
    }
  };

  // --- Actions ---

  const handleProcure = async (values) => {
    try {
      const payload = {
        ...values,
        purchase_date: values.purchase_date?.format('YYYY-MM-DD'),
        item_id: currentItem?.id // Optional if creating new item
      };
      const res = await api.post('/inventory/procure', payload);
      if (res.success) {
        message.success('入库成功');
        setIsProcureModalOpen(false);
        procureForm.resetFields();
        fetchItems();
      }
    } catch (err) {
      message.error('入库失败');
    }
  };

  const handleUse = async (values) => {
    try {
      const payload = {
        item_id: currentItem.id,
        quantity: values.quantity,
        purpose: values.purpose
      };
      const res = await api.post('/inventory/use', payload);
      if (res.success) {
        message.success('领用出库成功');
        setIsUseModalOpen(false);
        useForm.resetFields();
        fetchItems();
      }
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleAudit = async (values) => {
    try {
      const payload = {
        item_id: currentItem.id,
        actual_stock: values.actual_stock,
        notes: values.notes
      };
      const res = await api.post('/inventory/audit', payload);
      if (res.success) {
        if (res.discrepancy !== 0) {
            message.warning(`盘点完成，发现差异: ${res.discrepancy}`);
        } else {
            message.success('盘点一致');
        }
        setIsAuditModalOpen(false);
        auditForm.resetFields();
        fetchItems();
      }
    } catch (err) {
      message.error('盘点失败');
    }
  };

  const showHistory = async (item, type) => {
      setCurrentItem(item);
      setHistoryType(type);
      setIsHistoryModalOpen(true);
      try {
          const res = await api.get(`/api/inventory/history?item_id=${item.id}&type=${type}`);
          if (res.success) setHistoryData(res.data);
      } catch(err) {}
  };

  // --- Columns ---

  const columns = [
    {
      title: '物品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
          <div>
              <div className="font-bold">{text}</div>
              <div className="text-xs text-gray-400">{record.category}</div>
          </div>
      )
    },
    {
      title: '当前库存',
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (text, record) => (
          <div className="flex items-center gap-2">
              <span className={`text-lg font-mono ${text < record.min_stock_alert ? 'text-red-500 font-bold' : ''}`}>
                  {text} {record.unit}
              </span>
              {text < record.min_stock_alert && <Tag color="red">库存不足</Tag>}
          </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => {
              setCurrentItem(record);
              // Pre-fill procure form for existing item
              procureForm.setFieldsValue({ item_name: record.name, category: record.category });
              setIsProcureModalOpen(true);
          }}>入库</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => {
              setCurrentItem(record);
              setIsUseModalOpen(true);
          }}>领用</Button>
          <Button size="small" icon={<ScanOutlined />} onClick={() => {
              setCurrentItem(record);
              setIsAuditModalOpen(true);
          }}>盘点</Button>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => showHistory(record, 'usage')} />
        </div>
      )
    }
  ];

  const historyColumns = [
      { title: '时间', dataIndex: historyType === 'audit' ? 'audit_date' : 'created_at', render: t => dayjs(t).format('MM-DD HH:mm') },
      { 
          title: '变动/数量', 
          key: 'qty',
          render: (_, r) => {
              if (historyType === 'procurement') return `+${r.quantity}`;
              if (historyType === 'usage') return `-${r.quantity}`;
              if (historyType === 'audit') return (
                  <span>
                      账面:{r.expected_stock} / 实盘:{r.actual_stock} 
                      <span className={r.discrepancy !== 0 ? 'text-red-500 ml-2' : 'text-green-500 ml-2'}>
                          (差:{r.discrepancy})
                      </span>
                  </span>
              );
          }
      },
      { title: '经办人', dataIndex: 'real_name' },
      { title: '备注/用途', dataIndex: historyType === 'audit' ? 'notes' : (historyType === 'usage' ? 'purpose' : 'supplier') }
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between">
        <h1 className="text-2xl font-bold">库存管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setCurrentItem(null);
            procureForm.resetFields();
            setIsProcureModalOpen(true);
        }}>新物品采购</Button>
      </div>

      <div className="mb-4">
          <Input 
            prefix={<SearchOutlined />} 
            placeholder="搜索物品..." 
            className="w-64"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
      </div>

      <Table 
        columns={columns} 
        dataSource={items} 
        rowKey="id" 
        loading={loading}
      />

      {/* Procure Modal */}
      <Modal
        title={currentItem ? "补充库存" : "新物品采购"}
        open={isProcureModalOpen}
        onCancel={() => setIsProcureModalOpen(false)}
        onOk={() => procureForm.submit()}
      >
        <Form form={procureForm} layout="vertical" onFinish={handleProcure}>
            <Form.Item name="item_name" label="物品名称" rules={[{ required: true }]}>
                <Input disabled={!!currentItem} />
            </Form.Item>
            <Form.Item name="category" label="分类">
                <Select disabled={!!currentItem} mode="tags">
                    <Option value="办公用品">办公用品</Option>
                    <Option value="IT耗材">IT耗材</Option>
                    <Option value="清洁用品">清洁用品</Option>
                </Select>
            </Form.Item>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="quantity" label="采购数量" rules={[{ required: true }]}>
                        <InputNumber min={1} className="w-full" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="price_per_unit" label="单价">
                        <InputNumber min={0} prefix="¥" className="w-full" />
                    </Form.Item>
                </Col>
            </Row>
            <Form.Item name="supplier" label="供应商">
                <Input />
            </Form.Item>
            <Form.Item name="purchase_date" label="采购日期" initialValue={dayjs()}>
                <DatePicker className="w-full" />
            </Form.Item>
        </Form>
      </Modal>

      {/* Use Modal */}
      <Modal
        title={`领用出库: ${currentItem?.name}`}
        open={isUseModalOpen}
        onCancel={() => setIsUseModalOpen(false)}
        onOk={() => useForm.submit()}
      >
        <Form form={useForm} layout="vertical" onFinish={handleUse}>
            <Form.Item name="quantity" label="领用数量" rules={[{ required: true }]}>
                <InputNumber min={1} max={currentItem?.current_stock} className="w-full" />
            </Form.Item>
            <Form.Item name="purpose" label="用途/领用人">
                <Input.TextArea placeholder="例如：新员工入职领取，张三" />
            </Form.Item>
        </Form>
      </Modal>

      {/* Audit Modal */}
      <Modal
        title={`库存盘点: ${currentItem?.name}`}
        open={isAuditModalOpen}
        onCancel={() => setIsAuditModalOpen(false)}
        onOk={() => auditForm.submit()}
      >
        <Alert message={`系统当前库存: ${currentItem?.current_stock}`} type="info" className="mb-4" />
        <Form form={auditForm} layout="vertical" onFinish={handleAudit}>
            <Form.Item name="actual_stock" label="实际清点数量" rules={[{ required: true }]}>
                <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="notes" label="差异原因说明">
                <Input.TextArea />
            </Form.Item>
        </Form>
      </Modal>

      {/* History Modal */}
      <Modal
          title="历史记录"
          open={isHistoryModalOpen}
          onCancel={() => setIsHistoryModalOpen(false)}
          footer={null}
          width={700}
      >
          <Tabs activeKey={historyType} onChange={(k) => showHistory(currentItem, k)}>
              <TabPane tab="领用记录" key="usage" />
              <TabPane tab="采购记录" key="procurement" />
              <TabPane tab="盘点记录" key="audit" />
          </Tabs>
          <Table 
            columns={historyColumns} 
            dataSource={historyData} 
            rowKey="id" 
            size="small" 
            pagination={{ pageSize: 5 }}
          />
      </Modal>
    </div>
  );
};

export default InventoryManagement;
