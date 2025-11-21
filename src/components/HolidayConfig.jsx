import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input, InputNumber, Select, message, Empty, Spin, Tag, AutoComplete, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, AppstoreOutlined } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';
import dayjs from 'dayjs';

const { Option } = Select;

const HolidayConfig = () => {
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(dayjs().year());
  const [holidays, setHolidays] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [vacationTypes, setVacationTypes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [recentNames, setRecentNames] = useState([]);
  const [form, setForm] = useState({
    name: '',
    days: 1,
    month: 1,
    vacation_type_id: null
  });
  const [batchForm, setBatchForm] = useState({
    name: '',
    days: 1,
    months: []
  });

  useEffect(() => {
    loadData();
    loadVacationTypes();
    // 加载最近使用的假期名称
    const saved = localStorage.getItem('recentHolidayNames');
    if (saved) {
      try {
        setRecentNames(JSON.parse(saved));
      } catch (e) {
        setRecentNames([]);
      }
    }
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // 加载节假日列表
      const holidaysRes = await fetch(`${getApiBaseUrl()}/holidays?year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const holidaysData = await holidaysRes.json();

      // 加载月度汇总
      const summaryRes = await fetch(`${getApiBaseUrl()}/holidays/monthly-summary?year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const summaryData = await summaryRes.json();

      if (holidaysData.success) {
        setHolidays(holidaysData.data);
      }

      if (summaryData.success) {
        setMonthlySummary(summaryData.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadVacationTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVacationTypes(result.data);
      }
    } catch (error) {
      console.error('加载假期类型失败:', error);
    }
  };

  const handleAdd = (month) => {
    setEditingHoliday(null);
    setForm({ name: '', days: 1, month, vacation_type_id: null });
    setModalVisible(true);
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setForm({
      name: holiday.name,
      days: holiday.days,
      month: holiday.month,
      vacation_type_id: holiday.vacation_type_id || null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个节假日配置吗？',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${getApiBaseUrl()}/holidays/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await response.json();

          if (result.success) {
            message.success('删除成功');
            loadData();
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.days || !form.month) {
      message.error('请填写完整信息');
      return;
    }

    if (form.name.length > 20) {
      message.error('假期名称不能超过20个字符');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingHoliday
        ? `${getApiBaseUrl()}/holidays/${editingHoliday.id}`
        : `${getApiBaseUrl()}/holidays`;

      const response = await fetch(url, {
        method: editingHoliday ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...form,
          year: editingHoliday ? undefined : year,
          vacation_type_id: form.vacation_type_id || null
        })
      });

      const result = await response.json();

      if (result.success) {
        message.success(editingHoliday ? '更新成功' : '创建成功');

        // 记忆假期名称
        if (!editingHoliday && form.name && !recentNames.includes(form.name)) {
          const newRecentNames = [form.name, ...recentNames.slice(0, 9)];
          setRecentNames(newRecentNames);
          localStorage.setItem('recentHolidayNames', JSON.stringify(newRecentNames));
        }

        setModalVisible(false);
        loadData();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleBatchSubmit = async () => {
    if (!batchForm.name || !batchForm.days || batchForm.months.length === 0) {
      message.error('请填写完整信息并选择至少一个月份');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      let successCount = 0;

      for (const month of batchForm.months) {
        const response = await fetch(`${getApiBaseUrl()}/holidays`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: batchForm.name,
            days: batchForm.days,
            month: month,
            year: year
          })
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        }
      }

      if (successCount > 0) {
        message.success(`成功添加 ${successCount} 个节假日`);

        // 记忆假期名称
        if (!recentNames.includes(batchForm.name)) {
          const newRecentNames = [batchForm.name, ...recentNames.slice(0, 9)];
          setRecentNames(newRecentNames);
          localStorage.setItem('recentHolidayNames', JSON.stringify(newRecentNames));
        }

        setBatchModalVisible(false);
        setBatchForm({ name: '', days: 1, months: [] });
        loadData();
      } else {
        message.error('批量添加失败');
      }
    } catch (error) {
      message.error('批量添加失败');
    }
  };

  const handleQuickAdd = async (name, days, month) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/holidays`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, days, month, year })
      });

      const result = await response.json();
      if (result.success) {
        message.success(`已添加${name}`);
        loadData();
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      message.error('添加失败');
    }
  };

  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const getMonthHolidays = (month) => {
    return holidays.filter(h => h.month === month);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">节假日配置</h1>
          <p className="text-gray-600 mt-1">配置全年节假日和假期天数</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">年份:</span>
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 120 }}
          >
            {[0, 1, 2, 3, 4].map(i => (
              <Option key={i} value={dayjs().year() - 2 + i}>
                {dayjs().year() - 2 + i}年
              </Option>
            ))}
          </Select>
        </div>
      </div>

      {/* 快速操作按钮组 */}
      <div className="flex gap-2 flex-wrap">
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('元旦', 1, 1)}>
          快速添加元旦
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('春节', 7, 2)}>
          快速添加春节
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('清明节', 3, 4)}>
          快速添加清明节
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('劳动节', 5, 5)}>
          快速添加劳动节
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('端午节', 3, 6)}>
          快速添加端午节
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('中秋节', 3, 9)}>
          快速添加中秋节
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => handleQuickAdd('国庆节', 7, 10)}>
          快速添加国庆节
        </Button>
        <Button type="primary" icon={<AppstoreOutlined />} onClick={() => setBatchModalVisible(true)}>
          批量配置
        </Button>
      </div>

      {/* 月度卡片视图 */}
      <Spin spinning={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {monthNames.map((monthName, index) => {
            const month = index + 1;
            const monthHolidays = getMonthHolidays(month);
            const summary = monthlySummary.find(s => s.month === month) || { total_days: 0, holiday_count: 0 };

            return (
              <Card
                key={month}
                className="shadow-sm hover:shadow-md transition-shadow"
                title={
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarOutlined className="text-blue-500" />
                      {monthName}
                    </span>
                    <Tag color="blue">{summary.total_days} 天</Tag>
                  </div>
                }
                extra={
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleAdd(month)}
                  >
                    新增
                  </Button>
                }
              >
                {monthHolidays.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无节假日"
                    className="my-4"
                  />
                ) : (
                  <div className="space-y-2">
                    {monthHolidays.map(holiday => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{holiday.name}</div>
                          <div className="text-sm text-gray-500">{holiday.days} 天</div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(holiday)}
                          />
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(holiday.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Spin>

      {/* 编辑模态框 */}
      <Modal
        title={editingHoliday ? '编辑节假日' : '新增节假日'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              假期类型
            </label>
            <Select
              placeholder="选择假期类型（可选）"
              value={form.vacation_type_id}
              onChange={(value) => {
                const selectedType = vacationTypes.find(t => t.id === value);
                setForm({
                  ...form,
                  vacation_type_id: value,
                  // 如果选择了假期类型且有基准天数，自动填充
                  days: selectedType?.base_days > 0 ? selectedType.base_days : form.days
                });
              }}
              allowClear
              className="w-full"
            >
              {vacationTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name} {type.base_days > 0 && `(${type.base_days}天)`}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              假期名称 <span className="text-red-500">*</span>
            </label>
            <AutoComplete
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              options={recentNames.map(name => ({ value: name }))}
              placeholder="输入假期名称或选择最近使用（最多20字符）"
              filterOption={(inputValue, option) =>
                option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              天数 <span className="text-red-500">*</span>
            </label>
            <InputNumber
              min={1}
              max={31}
              value={form.days}
              onChange={(value) => setForm({ ...form, days: value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              所属月份 <span className="text-red-500">*</span>
            </label>
            <Select
              value={form.month}
              onChange={(value) => setForm({ ...form, month: value })}
              className="w-full"
            >
              {monthNames.map((name, index) => (
                <Option key={index + 1} value={index + 1}>
                  {name}
                </Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* 批量配置模态框 */}
      <Modal
        title="批量配置节假日"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchSubmit}
        okText="批量添加"
        cancelText="取消"
        width={600}
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              假期名称 <span className="text-red-500">*</span>
            </label>
            <AutoComplete
              value={batchForm.name}
              onChange={(value) => setBatchForm({ ...batchForm, name: value })}
              options={recentNames.map(name => ({ value: name }))}
              placeholder="输入假期名称或选择最近使用"
              filterOption={(inputValue, option) =>
                option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              天数 <span className="text-red-500">*</span>
            </label>
            <InputNumber
              min={1}
              max={31}
              value={batchForm.days}
              onChange={(value) => setBatchForm({ ...batchForm, days: value })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              应用月份 <span className="text-red-500">*</span>
            </label>
            <Checkbox.Group
              value={batchForm.months}
              onChange={(values) => setBatchForm({ ...batchForm, months: values })}
              className="w-full"
            >
              <div className="grid grid-cols-4 gap-2">
                {monthNames.map((name, index) => (
                  <Checkbox key={index + 1} value={index + 1}>
                    {name}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
            <p className="text-sm text-gray-500 mt-2">
              选择的月份将批量添加该节假日
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HolidayConfig;
