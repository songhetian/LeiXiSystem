import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../utils/apiConfig';
import { getCurrentUser, isSystemAdmin } from '../../utils/auth';
import './SmartSchedule.css';

const SmartSchedule = () => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [restShiftId, setRestShiftId] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [scheduleRules, setScheduleRules] = useState([
    { id: Date.now(), employee_id: '', start_day: '', end_day: '', shift_id: '' }
  ]);
  const [generatedSchedule, setGeneratedSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    loadDepartments();
    loadRestShift();
  }, []);

  // 当月份改变时，更新开始和结束日期
  useEffect(() => {
    updateDateRange();
  }, [selectedMonth]);

  const updateDateRange = () => {
    const { year, month } = selectedMonth;
    // 月初
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    // 月末
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    setStartDate(start);
    setEndDate(end);
  };

  const handlePrevMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  useEffect(() => {
    if (selectedDepartment) {
      loadEmployees();
      loadShifts();
    }
  }, [selectedDepartment]);

  const loadDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(getApiUrl('/api/departments/list'), { headers });

      if (response.data.success) {
        const depts = response.data.data || [];
        setDepartments(depts);

        if (depts.length > 0) {
          setSelectedDepartment(depts[0].id);
        }
      } else {
        console.error('加载部门失败:', response.data.message);
        setDepartments([]);
      }
    } catch (error) {
      console.error('加载部门失败:', error);
      setDepartments([]);
    }
  };

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(getApiUrl('/api/employees'), { headers });
      if (response.data) {
        const deptEmployees = response.data.filter(
          e => e.department_id == selectedDepartment && e.status === 'active'
        );
        setEmployees(deptEmployees);
      }
    } catch (error) {
      console.error('获取员工列表失败:', error);
    }
  };

  const loadShifts = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(getApiUrl('/api/shifts'), {
        params: { is_active: 1, limit: 100 },
        headers
      });
      if (response.data.success) {
        setShifts(response.data.data);
      }
    } catch (error) {
      console.error('获取班次列表失败:', error);
    }
  };

  const loadRestShift = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(getApiUrl('/api/shifts/rest'), { headers });
      if (response.data.success) {
        setRestShiftId(response.data.data.id);
      }
    } catch (error) {
      console.error('获取休息班次失败:', error);
    }
  };

  const addRule = () => {
    setScheduleRules([...scheduleRules, {
      id: Date.now(),
      employee_id: '',
      start_day: '',
      end_day: '',
      shift_id: ''
    }]);
  };

  const removeRule = (id) => {
    if (scheduleRules.length > 1) {
      setScheduleRules(scheduleRules.filter(rule => rule.id !== id));
    }
  };

  const updateRule = (id, field, value) => {
    setScheduleRules(scheduleRules.map(rule => {
      if (rule.id === id) {
        const updatedRule = { ...rule, [field]: value };

        // 如果修改了开始日期，确保结束日期不小于开始日期
        if (field === 'start_day' && updatedRule.end_day && parseInt(value) > parseInt(updatedRule.end_day)) {
          updatedRule.end_day = value;
        }

        // 如果修改了结束日期，确保结束日期不小于开始日期
        if (field === 'end_day' && updatedRule.start_day && parseInt(value) < parseInt(updatedRule.start_day)) {
          return rule; // 不更新，保持原值
        }

        return updatedRule;
      }
      return rule;
    }));
  };

  const parseScheduleRules = () => {
    const rules = [];

    for (const rule of scheduleRules) {
      if (!rule.employee_id || !rule.start_day || !rule.end_day) {
        continue; // 跳过不完整的规则
      }

      const employee = employees.find(e => e.id == rule.employee_id);
      if (!employee) continue;

      let shift = null;
      let action = '休息';

      if (rule.shift_id && rule.shift_id != restShiftId) {
        shift = shifts.find(s => s.id == rule.shift_id);
        action = shift?.name || '休息';
      }

      rules.push({
        employee_id: employee.id,
        employee_name: employee.real_name,
        start_day: parseInt(rule.start_day),
        end_day: parseInt(rule.end_day),
        action: action,
        shift_id: shift?.id || null,
        shift_name: shift?.name || null
      });
    }

    return rules;
  };

  const generateSchedule = async () => {
    if (!selectedDepartment || !startDate || !endDate) {
      setModalMessage('请填写完整信息');
      setShowModal(true);
      return;
    }

    setLoading(true);
    setModalMessage('正在生成排班方案...');
    setShowModal(true);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 解析排班规则
      const parsedRules = parseScheduleRules();

      const response = await axios.post(getApiUrl('/api/smart-schedule/generate-excel'), {
        departmentId: selectedDepartment,
        startDate,
        endDate,
        textRules: parsedRules
      }, {
        headers,
        responseType: 'blob'  // 接收文件
      });

      // 下载Excel文件
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `排班方案_${startDate}_${endDate}.xlsx`;
      link.click();

      setModalMessage('✅ 排班方案已生成并下载！\n\n请查看Excel文件，确认后可通过"排班管理"页面导入。');
    } catch (error) {
      console.error('生成排班失败:', error);
      setModalMessage('❌ 生成排班失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const applySchedule = async () => {
    if (!generatedSchedule) {
      alert('请先生成排班方案');
      return;
    }

    if (conflicts.length > 0) {
      if (!window.confirm(`检测到 ${conflicts.length} 个冲突，确定要应用吗？`)) {
        return;
      }
    }

    if (!window.confirm('确定要应用此排班方案吗？这将覆盖现有排班。')) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.post(getApiUrl('/api/smart-schedule/apply'), {
        schedule: generatedSchedule.schedule
      }, { headers });

      alert('排班方案已应用！员工将收到通知。');
      setGeneratedSchedule(null);
      setConflicts([]);
    } catch (error) {
      console.error('应用排班失败:', error);
      alert('应用排班失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const exportSchedule = () => {
    if (!generatedSchedule) return;

    const csv = convertToCSV(generatedSchedule.schedule);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `schedule_${startDate}_${endDate}.csv`;
    link.click();
  };

  const convertToCSV = (schedule) => {
    const headers = ['员工ID', '班次ID', '日期', '是否休息'];
    const rows = schedule.map(s => [
      s.employee_id,
      s.shift_id || '',
      s.schedule_date,
      s.is_rest_day ? '是' : '否'
    ]);

    return [headers, ...rows].map(row => row.jo).join('\n');
  };

  return (
    <div className="smart-schedule-container">
      <h2>🤖 智能排班</h2>

      {/* 模态框 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !loading && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-line' }}>{modalMessage}</p>
            </div>
            {!loading && (
              <div className="modal-footer">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-close-modal"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="schedule-form">
        <div className="form-section">
          <h3>基本设置</h3>
          <div className="form-row">
            <div className="form-group">
              <label>部门</label>
              <select
                className="department-selector"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                {departments.length === 0 ? (
                  <option value="">加载中...</option>
                ) : (
                  departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))
                )}
              </select>
            </div>
            <div className="form-group">
              <label>排班月份</label>
              <div className="month-selector">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="btn-month-nav"
                >
                  ◀
                </button>
                <div className="month-display">
                  {selectedMonth.year}年 {selectedMonth.month}月
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="btn-month-nav"
                >
                  ▶
                </button>
              </div>
              <div className="date-range-hint">
                {startDate} 至 {endDate}
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="rules-header">
            <h3>排班规则</h3>
            <button onClick={addRule} className="btn-add-rule">
              ➕ 添加规则
            </button>
          </div>

          <div className="rules-list">
            {scheduleRules.map((rule, index) => (
              <div key={rule.id} className="rule-item">
                <div className="rule-number">{index + 1}</div>

                <div className="rule-fields">
                  <div className="form-group">
                    <label>客服</label>
                    <select
                      value={rule.employee_id}
                      onChange={(e) => updateRule(rule.id, 'employee_id', e.target.value)}
                    >
                      <option value="">请选择客服</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.real_name} ({emp.employee_no})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>开始日期</label>
                    <select
                      value={rule.start_day}
                      onChange={(e) => updateRule(rule.id, 'start_day', e.target.value)}
                    >
                      <option value="">请选择</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}号</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>结束日期</label>
                    <select
                      value={rule.end_day}
                      onChange={(e) => updateRule(rule.id, 'end_day', e.target.value)}
                      disabled={!rule.start_day}
                    >
                      <option value="">请选择</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1)
                        .filter(day => !rule.start_day || day >= parseInt(rule.start_day))
                        .map(day => (
                          <option key={day} value={day}>{day}号</option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>班次</label>
                    <select
                      value={rule.shift_id}
                      onChange={(e) => updateRule(rule.id, 'shift_id', e.target.value)}
                    >
                      <option value="">请选择班次</option>
                      {shifts.map(shift => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {scheduleRules.length > 1 && (
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="btn-remove-rule"
                    title="删除此规则"
                  >
                    ❌
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-600 mt-4">
            <p>💡 提示：</p>
            <ul className="list-disc list-inside ml-2">
              <li>先选择开始日期，结束日期会自动过滤，只显示大于等于开始日期的选项</li>
              <li>例如：开始日期选1号，结束日期选10号，表示1号到10号</li>
              <li>选择"休息"表示该时间段休息</li>
              <li>没有设置规则的员工和日期将在Excel中留空，可手动填写</li>
            </ul>
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={generateSchedule}
            disabled={loading}
            className="btn-generate"
          >
            {loading ? '生成中...' : '📥 生成并下载Excel排班方案'}
          </button>
        </div>
      </div>



      <div className="help-section">
        <h3>💡 使用说明</h3>
        <ul>
          <li><strong>添加规则：</strong>点击"添加规则"按钮可以添加多个排班规则</li>
          <li><strong>设置排班：</strong>为每个客服选择日期范围和班次</li>
          <li><strong>生成Excel：</strong>点击生成按钮会下载Excel文件，不会直接写入数据库</li>
          <li><strong>导入排班：</strong>确认Excel内容无误后，在"排班管理"页面使用"导入Excel"功能</li>
          <li><strong>灵活调整：</strong>可以在Excel中手动调整排班后再导入</li>
        </ul>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">📝 排班规则示例</h4>
          <div className="text-sm text-gray-700">
            <p>• 张三：1-10 休息</p>
            <p>• 李四：1-5 早班</p>
            <p>• 王五：6-10 晚班</p>
            <p>• 赵六：11-15 中班</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartSchedule;
