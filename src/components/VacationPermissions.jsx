import React from 'react';
import { Card, Button, Table, Tag, Space, Modal, Form, Input, Select } from 'antd';

const VacationPermissions = () => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState(null);

  const columns = [
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: '权限类型',
      dataIndex: 'permissionType',
      key: 'permissionType',
      render: (text) => (
        <Tag color={text === '查看' ? 'blue' : text === '编辑' ? 'green' : 'orange'}>
          {text}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const data = [
    {
      key: '1',
      role: '管理员',
      permissionType: '编辑',
    },
    {
      key: '2',
      role: '人事专员',
      permissionType: '编辑',
    },
    {
      key: '3',
      role: '部门经理',
      permissionType: '查看',
    },
    {
      key: '4',
      role: '普通员工',
      permissionType: '查看',
    },
  ];

  const handleEdit = (record) => {
    setEditingRecord(record);
    setIsModalVisible(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色 "${record.role}" 的权限设置吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk() {
        // 删除逻辑
        console.log('删除记录:', record);
      },
    });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    // 保存逻辑
    setIsModalVisible(false);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <div className="p-6">
      <Card
        title="假期权限管理"
        extra={
          <Button type="primary" onClick={handleAdd}>
            添加权限
          </Button>
        }
      >
        <Table columns={columns} dataSource={data} pagination={false} />
      </Card>

      <Modal
        title={editingRecord ? "编辑权限" : "添加权限"}
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="角色" required>
            <Select placeholder="请选择角色">
              <Select.Option value="管理员">管理员</Select.Option>
              <Select.Option value="人事专员">人事专员</Select.Option>
              <Select.Option value="部门经理">部门经理</Select.Option>
              <Select.Option value="普通员工">普通员工</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="权限类型" required>
            <Select placeholder="请选择权限类型">
              <Select.Option value="查看">查看</Select.Option>
              <Select.Option value="编辑">编辑</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VacationPermissions;
