import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Space, message, Card, DatePicker, InputNumber, Transfer, TreeSelect } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const AssessmentPlanForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams(); // For editing existing plan
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [users, setUsers] = useState([]); // All users for selection
  const [departments, setDepartments] = useState([]); // All departments for selection
  const [targetUsers, setTargetUsers] = useState([]); // Users selected for the plan

  useEffect(() => {
    fetchPublishedExams();
    fetchUsersAndDepartments();
    if (id) {
      fetchAssessmentPlanDetails(id);
    } else {
      form.setFieldsValue({ max_attempts: 1 });
    }
  }, [id]);

  const fetchPublishedExams = async () => {
    try {
      const response = await axios.get('/api/exams', {
        params: { status: 'published' },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExams(response.data.data.exams);
    } catch (error) {
      message.error('获取已发布试卷失败');
      console.error('Failed to fetch published exams:', error);
    }
  };

  const fetchUsersAndDepartments = async () => {
    try {
      // Assuming API endpoints for users and departments exist
      const [usersRes, departmentsRes] = await Promise.all([
        axios.get('/api/users-with-roles', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get('/api/departments', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      ]);
      setUsers(usersRes.data.map(user => ({ key: user.id.toString(), title: user.real_name || user.username })));
      setDepartments(departmentsRes.data.map(dept => ({ id: dept.id, pId: 0, value: dept.id.toString(), title: dept.name })));
    } catch (error) {
      message.error('获取用户和部门信息失败');
      console.error('Failed to fetch users or departments:', error);
    }
  };

  const fetchAssessmentPlanDetails = async (planId) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/assessment-plans/${planId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const plan = response.data.data;

      // Parse target_users from JSON string to array of user IDs
      let initialTargetUsers = [];
      if (plan.target_users && typeof plan.target_users === 'string') {
        try {
          initialTargetUsers = JSON.parse(plan.target_users).map(String); // Ensure string keys for Transfer
        } catch (e) {
          console.error('Failed to parse target_users:', e);
        }
      }
      setTargetUsers(initialTargetUsers);

      form.setFieldsValue({
        ...plan,
        exam_id: plan.exam_id,
        time_range: [dayjs(plan.start_time), dayjs(plan.end_time)],
      });
    } catch (error) {
      message.error('获取考核计划详情失败');
      console.error('Failed to fetch assessment plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values, status = 'draft') => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        start_time: values.time_range[0].toISOString(),
        end_time: values.time_range[1].toISOString(),
        target_users: JSON.stringify(targetUsers.map(Number)), // Convert back to array of numbers
        status: status,
      };
      delete payload.time_range;

      if (id) {
        await axios.put(`/api/assessment-plans/${id}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('考核计划更新成功');
      } else {
        await axios.post('/api/assessment-plans', payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('考核计划创建成功');
      }
      navigate('/assessment/plans'); // Navigate back to plan list
    } catch (error) {
      message.error(`操作失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to save assessment plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    form.validateFields().then((values) => {
      onFinish(values, 'draft');
    }).catch(info => {
      console.log('Validate Failed:', info);
      message.error('请检查表单填写');
    });
  };

  const handlePublish = () => {
    form.validateFields().then((values) => {
      onFinish(values, 'published');
    }).catch(info => {
      console.log('Validate Failed:', info);
      message.error('请检查表单填写');
    });
  };

  const handleUserTransferChange = (newTargetKeys) => {
    setTargetUsers(newTargetKeys);
  };

  const handleDepartmentSelect = async (value) => {
    if (value) {
      try {
        // Assuming an API to get users by department ID
        const response = await axios.get(`/api/users?department_id=${value}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const departmentUserIds = response.data.map(user => user.id.toString());
        // Add new users from department, avoid duplicates
        setTargetUsers(prev => Array.from(new Set([...prev, ...departmentUserIds])));
      } catch (error) {
        message.error('获取部门用户失败');
        console.error('Failed to fetch department users:', error);
      }
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title={id ? '编辑考核计划' : '创建考核计划'} loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            max_attempts: 1,
          }}
        >
          {/* 基本信息 */}
          <Form.Item
            name="title"
            label="计划标题"
            rules={[{ required: true, message: '请输入计划标题' }]}
          >
            <Input placeholder="请输入计划标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="计划描述"
          >
            <TextArea rows={4} placeholder="请输入计划描述" />
          </Form.Item>

          {/* 试卷选择 */}
          <Form.Item
            name="exam_id"
            label="选择试卷"
            rules={[{ required: true, message: '请选择考核试卷' }]}
          >
            <Select placeholder="请选择已发布的试卷">
              {exams.map(exam => (
                <Option key={exam.id} value={exam.id}>{exam.title}</Option>
              ))}
            </Select>
          </Form.Item>

          {/* 时间范围选择 */}
          <Form.Item
            name="time_range"
            label="考核时间范围"
            rules={[{ required: true, message: '请选择考核时间范围' }, {
              validator: (_, value) => {
                if (value && value[0] && value[1] && value[0].isBefore(value[1])) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('结束时间必须晚于开始时间!'));
              },
            }]}
          >
            <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          {/* 目标用户选择 */}
          <Form.Item label="目标用户">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="选择部门导入用户"
                style={{ width: 200 }}
                onChange={handleDepartmentSelect}
                allowClear
              >
                {departments.map(dept => (
                  <Option key={dept.id} value={dept.id}>{dept.title}</Option>
                ))}
              </Select>
              <Transfer
                dataSource={users}
                titles={['所有用户', '已选用户']}
                targetKeys={targetUsers}
                onChange={handleUserTransferChange}
                render={item => item.title}
                rowKey={item => item.key}
                showSearch
                filterOption={(inputValue, item) =>
                  item.title.indexOf(inputValue) !== -1
                }
                listStyle={{
                  width: '48%',
                  height: 300,
                }}
              />
            </Space>
          </Form.Item>

          {/* 尝试次数设置 */}
          <Form.Item
            name="max_attempts"
            label="最大尝试次数"
            rules={[{ required: true, message: '请输入最大尝试次数' }, { type: 'number', min: 1, message: '尝试次数必须大于0' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="default" onClick={handleSaveDraft} loading={loading}>
                保存草稿
              </Button>
              <Button type="primary" onClick={handlePublish} loading={loading}>
                发布计划
              </Button>
              <Button onClick={() => navigate('/assessment/plans')} disabled={loading}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AssessmentPlanForm;
