import logger from '@/utils/logger';
import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/date';
import api from '../../api';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig';
import {
  BanknotesIcon,
  EyeIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  LockClosedIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import { Modal, Input, Form, Button, Table, Select, DatePicker, Descriptions, Tag } from 'antd';
import dayjs from 'dayjs';

export default function MyPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [filters, setFilters] = useState({ year: null, month: null });
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordToken, setPasswordToken] = useState(null);
  const [isDefaultPassword, setIsDefaultPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [form] = Form.useForm();
  const [changePasswordForm] = Form.useForm();
  const [setPasswordForm] = Form.useForm();

  useEffect(() => {
    fetchPayslips();
    checkPasswordStatus();
  }, [pagination.page, filters]);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };

      const response = await api.get('/payslips/my-payslips', { params });

      if (response.data.success) {
        // 只展示已发送和已查看的工资条，过滤掉草稿状态
        const filteredPayslips = response.data.data.filter(p => p.status === 'sent' || p.status === 'viewed' || p.status === 'confirmed');
        setPayslips(filteredPayslips);
        setPagination(prev => ({
          ...prev,
          total: filteredPayslips.length
        }));
      }
    } catch (error) {
      logger.error('获取工资条列表失败:', error);
      toast.error('获取工资条列表失败');
    } finally {
      setLoading(false);
    }
  };

  const checkPasswordStatus = async () => {
    try {
      const response = await api.get('/payslips/password-status');
      if (response.data.success) {
        setHasPassword(response.data.has_password);
        setIsDefaultPassword(response.data.is_default);
      }
    } catch (error) {
      logger.error('检查密码状态失败:', error);
    }
  };

  const handleViewDetail = (payslip) => {
    setSelectedPayslip(payslip);
    if (!passwordToken) {
      setShowPasswordModal(true);
    } else {
      fetchPayslipDetail(payslip.id);
    }
  };

  const handleVerifyPassword = async () => {
    try {
      logger.debug('[Frontend] Verifying password...');
      if (!password) {
        toast.error('请输入密码');
        return;
      }

      // 使用 fetch API 而不是 axios
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/payslips/verify-password'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      logger.debug('[Frontend] Password verification response:', data);

      if (data.success) {
        logger.debug('[Frontend] Password verified successfully, token:', data.token ? data.token.substring(0, 30) + '...' : 'none');
        const newToken = data.token;
        setIsDefaultPassword(data.is_default);
        setShowPasswordModal(false);
        setPassword('');

        if (selectedPayslip) {
          logger.debug('[Frontend] Fetching payslip detail for id:', selectedPayslip.id);
          // 直接使用新获取的 token，而不是依赖状态更新
          await fetchPayslipDetailWithToken(selectedPayslip.id, newToken);
        }

        if (data.is_default) {
          toast.warning('您使用的是默认密码，建议修改密码');
        }
      } else {
        logger.debug('[Frontend] Password verification failed:', data.message);
        toast.error(data.message || '密码验证失败');
      }
    } catch (error) {
      logger.error('[Frontend] 密码验证失败:', error);
      toast.error(error.message || '密码验证失败');
    }
  };

  const fetchPayslipDetail = async (id) => {
    try {
      logger.debug('[Frontend] Fetching payslip detail for id:', id);
      logger.debug('[Frontend] PasswordToken:', passwordToken ? passwordToken.substring(0, 30) + '...' : 'none');
      
      // 使用 fetch API 而不是 axios，避免拦截器问题
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'X-Payslip-Token': passwordToken
      };
      logger.debug('[Frontend] Headers to send:', headers);
      
      const response = await fetch(getApiUrl(`/payslips/${id}`), {
        method: 'GET',
        headers: headers
      });

      const data = await response.json();
      logger.debug('[Frontend] Response:', data);

      if (data.success) {
        setSelectedPayslip(data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      logger.error('[Frontend] 获取工资条详情失败:', error);
      toast.error(error.message || '获取工资条详情失败');

      if (error.message.includes('401') || error.message.includes('需要验证二级密码')) {
        logger.debug('[Frontend] Clearing passwordToken and showing password modal');
        setPasswordToken(null);
        setShowPasswordModal(true);
      }
    }
  };

  const fetchPayslipDetailWithToken = async (id, token) => {
    try {
      logger.debug('[Frontend] Fetching payslip detail with token for id:', id);
      logger.debug('[Frontend] Token:', token ? token.substring(0, 30) + '...' : 'none');
      
      // 直接使用传入的 token
      const jwtToken = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${jwtToken}`,
        'X-Payslip-Token': token
      };
      logger.debug('[Frontend] Headers to send:', headers);
      
      const response = await fetch(getApiUrl(`/payslips/${id}`), {
        method: 'GET',
        headers: headers
      });

      const data = await response.json();
      logger.debug('[Frontend] Response:', data);

      if (data.success) {
        setSelectedPayslip(data.data);
        setShowDetailModal(true);
        // 保存 token 到状态中，供后续使用
        setPasswordToken(token);
      }
    } catch (error) {
      logger.error('[Frontend] 获取工资条详情失败:', error);
      toast.error(error.message || '获取工资条详情失败');

      if (error.message.includes('401') || error.message.includes('需要验证二级密码')) {
        logger.debug('[Frontend] Clearing passwordToken and showing password modal');
        setPasswordToken(null);
        setShowPasswordModal(true);
      }
    }
  };

  const handleConfirmPayslip = async () => {
    try {
      const response = await api.post(`/payslips/${selectedPayslip.id}/confirm`);

      if (response.data.success) {
        toast.success('工资条已确认');
        setShowDetailModal(false);
        fetchPayslips();
      }
    } catch (error) {
      logger.error('确认工资条失败:', error);
      toast.error('确认工资条失败');
    }
  };

  const handleChangePassword = async (values) => {
    try {
      const response = await api.post('/payslips/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });

      if (response.data.success) {
        toast.success('密码修改成功');
        setShowChangePasswordModal(false);
        changePasswordForm.resetFields();
        setIsDefaultPassword(false);
        // 清除旧的 passwordToken，因为密码已修改
        setPasswordToken(null);
      }
    } catch (error) {
      logger.error('修改密码失败:', error);
      toast.error(error.response?.data?.message || '修改密码失败');
    }
  };

  const handleSetPassword = async (values) => {
    try {
      const response = await api.post('/payslips/set-password', {
        password: values.password,
        confirmPassword: values.confirmPassword
      });

      if (response.data.success) {
        toast.success('密码设置成功');
        setShowSetPasswordModal(false);
        setPasswordForm.resetFields();
        setHasPassword(true);
        setIsDefaultPassword(true);
      }
    } catch (error) {
      logger.error('设置密码失败:', error);
      toast.error(error.response?.data?.message || '设置密码失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      draft: { color: 'default', text: '草稿' },
      sent: { color: 'processing', text: '已发放' },
      viewed: { color: 'warning', text: '已查看' },
      confirmed: { color: 'success', text: '已确认' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '工资月份',
      dataIndex: 'salary_month',
      key: 'salary_month',
      align: 'center',
      render: (text) => dayjs(text).format('YYYY年MM月')
    },
    {
      title: '发放日期',
      dataIndex: 'payment_date',
      key: 'payment_date',
      align: 'center',
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD') : '-'
    },
    {
      title: '实发工资',
      dataIndex: 'net_salary',
      key: 'net_salary',
      align: 'center',
      render: (text) => <span className="text-green-600 font-semibold">¥{parseFloat(text).toFixed(2)}</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <div className="flex gap-2 justify-center">
          <Button
            type="link"
            icon={<EyeIcon className="w-4 h-4" />}
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BanknotesIcon className="w-8 h-8 text-blue-500" />
            我的工资条
          </h1>
          <p className="text-gray-500 mt-1">查看和管理您的工资条信息</p>
        </div>
        <div className="flex gap-2">
          {hasPassword ? (
            <>
              {isDefaultPassword && (
                <Button
                  type="primary"
                  danger
                  icon={<KeyIcon className="w-4 h-4" />}
                  onClick={() => setShowChangePasswordModal(true)}
                >
                  修改密码
                </Button>
              )}
              <Button
                icon={<KeyIcon className="w-4 h-4" />}
                onClick={() => setShowChangePasswordModal(true)}
              >
                修改二级密码
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<KeyIcon className="w-4 h-4" />}
              onClick={() => setShowSetPasswordModal(true)}
            >
              设置二级密码
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex gap-4">
          <DatePicker
            picker="year"
            placeholder="选择年份"
            onChange={(date) => setFilters(prev => ({ ...prev, year: date ? date.year() : null }))}
          />
          <Select
            placeholder="选择月份"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, month: value }))}
            options={Array.from({ length: 12 }, (_, i) => ({
              label: `${i + 1}月`,
              value: i + 1
            }))}
          />
          <Button type="primary" onClick={fetchPayslips}>
            查询
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table
          columns={columns}
          dataSource={payslips}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, page, limit: pageSize }));
              fetchPayslips(); // 重新获取数据
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </div>

      <Modal
        title="验证二级密码"
        open={showPasswordModal}
        onOk={handleVerifyPassword}
        onCancel={() => {
          setShowPasswordModal(false);
          setPassword('');
        }}
      >
        <div className="py-4">
          <p className="mb-4 text-gray-600">为保护您的隐私，查看工资条需要验证二级密码</p>
          <Input.Password
            placeholder="请输入二级密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleVerifyPassword}
          />
        </div>
      </Modal>

      <Modal
        title="工资条详情"
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>
            关闭
          </Button>,
          selectedPayslip?.status !== 'confirmed' && (
            <Button key="confirm" type="primary" onClick={handleConfirmPayslip}>
              确认工资条
            </Button>
          )
        ]}
        width={800}
      >
        {selectedPayslip && (
          <div className="py-4">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="员工姓名">{selectedPayslip.employee_name}</Descriptions.Item>
              <Descriptions.Item label="员工工号">{selectedPayslip.employee_no}</Descriptions.Item>
              <Descriptions.Item label="部门">{selectedPayslip.department_name}</Descriptions.Item>
              <Descriptions.Item label="职位">{selectedPayslip.position_name}</Descriptions.Item>
              <Descriptions.Item label="工资月份">{dayjs(selectedPayslip.salary_month).format('YYYY年MM月')}</Descriptions.Item>
              <Descriptions.Item label="发放日期">{selectedPayslip.payment_date ? dayjs(selectedPayslip.payment_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
            </Descriptions>

            <h3 className="text-lg font-semibold mt-6 mb-4">考勤统计</h3>
            <Descriptions bordered column={3}>
              <Descriptions.Item label="出勤天数">{selectedPayslip.attendance_days}</Descriptions.Item>
              <Descriptions.Item label="迟到次数">{selectedPayslip.late_count}</Descriptions.Item>
              <Descriptions.Item label="早退次数">{selectedPayslip.early_leave_count}</Descriptions.Item>
              <Descriptions.Item label="请假天数">{selectedPayslip.leave_days}</Descriptions.Item>
              <Descriptions.Item label="加班时长">{selectedPayslip.overtime_hours}小时</Descriptions.Item>
              <Descriptions.Item label="缺勤天数">{selectedPayslip.absent_days}</Descriptions.Item>
            </Descriptions>

            <h3 className="text-lg font-semibold mt-6 mb-4">工资明细</h3>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="基本工资">¥{parseFloat(selectedPayslip.basic_salary).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="岗位工资">¥{parseFloat(selectedPayslip.position_salary).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="绩效奖金">¥{parseFloat(selectedPayslip.performance_bonus).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="加班费">¥{parseFloat(selectedPayslip.overtime_pay).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="各类补贴">¥{parseFloat(selectedPayslip.allowances).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="各类扣款">¥{parseFloat(selectedPayslip.deductions).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="社保扣款">¥{parseFloat(selectedPayslip.social_security).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="公积金扣款">¥{parseFloat(selectedPayslip.housing_fund).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="个人所得税">¥{parseFloat(selectedPayslip.tax).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="其他扣款">¥{parseFloat(selectedPayslip.other_deductions).toFixed(2)}</Descriptions.Item>
            </Descriptions>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">实发工资：</span>
                <span className="text-2xl font-bold text-green-600">¥{parseFloat(selectedPayslip.net_salary).toFixed(2)}</span>
              </div>
            </div>

            {selectedPayslip.remark && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">备注：</h4>
                <p className="text-gray-600">{selectedPayslip.remark}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="修改二级密码"
        open={showChangePasswordModal}
        onCancel={() => {
          setShowChangePasswordModal(false);
          changePasswordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={changePasswordForm}
          onFinish={handleChangePassword}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => {
                setShowChangePasswordModal(false);
                changePasswordForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认修改
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置二级密码"
        open={showSetPasswordModal}
        onCancel={() => {
          setShowSetPasswordModal(false);
          setPasswordForm.resetFields();
        }}
        footer={null}
      >
        <div className="py-4">
          <p className="mb-4 text-gray-600">为保护您的隐私，查看工资条需要设置二级密码</p>
          <Form
            form={setPasswordForm}
            onFinish={handleSetPassword}
            layout="vertical"
          >
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度至少6位' }
              ]}
            >
              <Input.Password placeholder="请输入密码（至少6位）" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入密码" />
            </Form.Item>

            <Form.Item>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => {
                  setShowSetPasswordModal(false);
                  setPasswordForm.resetFields();
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  确认设置
                </Button>
              </div>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      <Modal
        title="修改二级密码"
        open={showChangePasswordModal}
        onCancel={() => {
          setShowChangePasswordModal(false);
          changePasswordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={changePasswordForm}
          onFinish={handleChangePassword}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => {
                setShowChangePasswordModal(false);
                changePasswordForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认修改
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
