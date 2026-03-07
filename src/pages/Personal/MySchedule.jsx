import logger from '@/utils/logger';
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'
import {
  CalendarIcon,
  ClockIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  XMarkIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline'

export default function MySchedule() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [employee, setEmployee] = useState(null)
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [showStatsModal, setShowStatsModal] = useState(false);

  // 统计相关状态
  const [expandedShifts, setExpandedShifts] = useState(['休息']); // 默认展开休息

  // 获取员工信息
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.id) {
      fetchEmployeeInfo(user.id)
    }
  }, [])

  // 当员工信息加载完成或月份变化时，获取排班数据
  useEffect(() => {
    if (employee) {
      fetchSchedules()
    }
  }, [employee, selectedMonth])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const response = await axios.get(getApiUrl(`/api/employees/by-user/${userId}`))
      if (response.data.success && response.data.data) {
        setEmployee(response.data.data)
      }
    } catch (error) {
      logger.error('获取员工信息失败:', error)
      toast.error('获取员工信息失败')
    }
  }

  const fetchSchedules = async () => {
    if (!employee) return

    setLoading(true)
    try {
      // 确保使用正确的日期格式（避免时区问题）
      const year = selectedMonth.getFullYear()
      const month = selectedMonth.getMonth() + 1
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const response = await axios.get(getApiUrl('/api/schedules'), {
        params: {
          employee_id: employee.id,
          start_date: startDate,
          end_date: endDate
        }
      })

      if (response.data.success) {
        // 确保日期格式正确，避免时区问题
        const formattedSchedules = response.data.data.map(schedule => ({
          ...schedule,
          schedule_date: schedule.schedule_date.split('T')[0] // 确保只取日期部分
        }))
        setSchedules(formattedSchedules)
      }
    } catch (error) {
      logger.error('获取排班数据失败:', error)
      toast.error('获取排班数据失败')
    } finally {
      setLoading(false)
    }
  }

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  // 导出个人排班
  const handleExport = () => {
    if (!employee) return
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    window.open(getApiUrl(`/api/schedules/export-personal?employee_id=${employee.id}&month=${monthStr}`), '_blank')
  }

  // 切换手风琴展开状态
  const toggleShiftExpand = (shiftName) => {
    setExpandedShifts(prev => {
      if (prev.includes(shiftName)) {
        return prev.filter(name => name !== shiftName)
      } else {
        return [...prev, shiftName]
      }
    })
  }

  // 统计逻辑
  const calculateStatistics = () => {
    const stats = {
      '休息': [], // 存储具体日期
      '未排班': [],
    };

    // 初始化其他班次
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const schedule = schedules.find(s => s.schedule_date === dateStr)

        if (schedule) {
             const isRest = Boolean(schedule.is_rest_day) ||
                         schedule.shift_name?.includes('休息') ||
                         Number(schedule.work_hours) === 0

            if (isRest) {
                stats['休息'].push({ date: dateStr, schedule })
                if (!stats['休息'].color) stats['休息'].color = '#16a34a' // Green
            } else {
                const name = schedule.shift_name || '其他'
                if (!stats[name]) {
                    stats[name] = []
                    stats[name].color = schedule.color || '#3b82f6'
                }
                stats[name].push({ date: dateStr, schedule })
            }
        } else {
            stats['未排班'].push({ date: dateStr })
            stats['未排班'].color = '#9ca3af' // Gray
        }
    }
    return stats
  }

  // 渲染统计侧边栏
  const renderStatistics = () => {
      const stats = calculateStatistics()
      // 过滤掉数量为0的，但如果所有都是0也显示
      const categories = Object.keys(stats).filter(key => stats[key].length > 0)

      // 排序，休息放第一个，未排班放最后，其他按数量排序
      categories.sort((a, b) => {
          if (a === '休息') return -1;
          if (b === '休息') return 1;
          if (a === '未排班') return 1;
          if (b === '未排班') return -1;
          return stats[b].length - stats[a].length;
      })

      if (!showStatsModal) return null

      return (
          <div
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowStatsModal(false)}
          >
              <div
                className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <ChartPieIcon className="w-5 h-5 text-blue-600" />
                          本月统计
                      </h3>
                      <button
                          onClick={() => setShowStatsModal(false)}
                          className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                      >
                          <XMarkIcon className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
                      {categories.map(category => {
                          const isExpanded = expandedShifts.includes(category);
                          const items = stats[category];
                          const color = items.color || '#3b82f6';

                          return (
                              <div key={category} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                  <button
                                    onClick={() => toggleShiftExpand(category)}
                                    className="w-full px-4 py-3 bg-white flex items-center justify-between hover:bg-gray-50 transition-colors"
                                  >
                                      <div className="flex items-center gap-3">
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                                          <span className="font-medium text-gray-700">{category}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                                              {items.length}天
                                          </span>
                                          <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                      </div>
                                  </button>

                                  {/* 折叠内容 */}
                                  <div
                                    className={`bg-gray-50/30 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
                                  >
                                      <div className="p-3 grid grid-cols-3 gap-2 text-xs">
                                          {items.map((item, idx) => (
                                              <div key={idx} className="bg-white px-3 py-2 rounded-lg border border-gray-100 text-gray-700 flex items-center justify-between shadow-sm">
                                              <span className="text-base font-bold text-gray-800">{item.date.split('-').slice(1).join('/')}</span>
                                                  {item.schedule && !category.includes('休息') && (
                                                      <span className="text-gray-400 scale-90 origin-right">
                                                          {item.schedule.start_time?.slice(0,5)}-{item.schedule.end_time?.slice(0,5)}
                                                      </span>
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )
                      })}

                      {categories.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
                      )}
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex justify-end">
                      <button
                          onClick={() => setShowStatsModal(false)}
                          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
                      >
                          关闭
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  // 渲染日历视图
  const renderCalendarView = () => {
    // 确保使用正确的时区处理月份
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days = []
    // 填充空白天数
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    // 填充实际天数
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    // 填充剩余空白天数，确保表格完整
    const totalDays = days.length
    const remainingDays = 7 - (totalDays % 7)
    if (remainingDays < 7) {
      for (let i = 0; i < remainingDays; i++) {
        days.push(null)
      }
    }

    const getScheduleForDay = (day) => {
      // 确保使用正确的日期格式进行比较
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return schedules.find(s => s.schedule_date === dateStr)
    }

    return (
      <div className="flex flex-col gap-6 h-full">
        {/* 日历 */}
        <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 月份选择器和操作栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/30 gap-4">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => {
                        setPickerYear(year);
                        setShowMonthPicker(!showMonthPicker);
                    }}
                    >
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {year}年 {month + 1}月
                        <ChevronDownIcon className={`w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-transform duration-200 ${showMonthPicker ? 'rotate-180' : ''}`} />
                    </h3>
                    </div>

                    {/* Custom Month Picker Popover */}
                    {showMonthPicker && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMonthPicker(false)} />
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-20 p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); setPickerYear(pickerYear - 1); }}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <span className="font-bold text-gray-800 text-lg">{pickerYear}年</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setPickerYear(pickerYear + 1); }}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900"
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 12 }, (_, i) => (
                                <button
                                key={i}
                                onClick={() => {
                                    setSelectedMonth(new Date(pickerYear, i));
                                    setShowMonthPicker(false);
                                }}
                                className={`
                                    py-2 rounded-lg text-sm font-medium transition-colors
                                    ${year === pickerYear && month === i
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }
                                    ${new Date().getFullYear() === pickerYear && new Date().getMonth() === i && !(year === pickerYear && month === i)
                                        ? 'text-blue-600 bg-blue-50'
                                        : ''
                                    }
                                `}
                                >
                                {i + 1}月
                                </button>
                            ))}
                        </div>
                        </div>
                    </>
                    )}
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button
                    onClick={() => setSelectedMonth(new Date(year, month - 1))}
                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 hover:text-gray-900 transition-colors"
                    >
                    <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <span className="w-px h-4 bg-gray-200 mx-1"></span>
                    <button
                    onClick={() => setSelectedMonth(new Date(year, month + 1))}
                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 hover:text-gray-900 transition-colors"
                    >
                    <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToCurrentMonth}
                        className="text-sm px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-1.5 shadow-sm"
                        title="回到今天"
                    >
                        <CalendarDaysIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">本月</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                 <button
                    onClick={() => setShowStatsModal(true)}
                    className="text-sm px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all flex items-center gap-1.5 shadow-sm font-medium"
                 >
                    <ChartPieIcon className="w-4 h-4" />
                    本月统计
                 </button>
                 <button
                    onClick={handleExport}
                    className="text-sm px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all flex items-center gap-1.5 shadow-sm font-medium"
                 >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    导出排班
                 </button>
            </div>
            </div>

            {/* 日历容器 */}
            <div className="">
            {/* 星期标题 */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => (
                <div key={day} className={`text-center font-medium text-gray-500 py-3 text-sm ${idx === 0 || idx === 6 ? 'text-orange-500' : ''}`}>
                    {day}
                </div>
                ))}
            </div>

            {/* 日历格子 */}
            {/* 日历格子 */}
            <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y divide-gray-200 border-l border-b border-gray-200 bg-white">
                {days.map((day, index) => {
                if (!day) {
                    return <div key={`empty-${index}`} className="bg-white" />
                }

                const schedule = getScheduleForDay(day)
                const dateObj = new Date(year, month, day);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isRest = schedule && (
                    Boolean(schedule.is_rest_day) ||
                    schedule.shift_name?.includes('休息') ||
                    Number(schedule.work_hours) === 0
                );

                return (
                    <div
                    key={day}
                    onClick={() => {
                        if (schedule) {
                        setSelectedSchedule(schedule)
                        setShowDetailModal(true)
                        }
                    }}
                    className="group relative p-2 transition-all cursor-pointer flex flex-col hover:bg-gray-50 bg-white"
                    >
                    {/* Date Header */}
                    <div className="flex items-start justify-between">
                        <div className={`
                            w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                            ${isToday
                            ? 'bg-blue-600 text-white shadow-sm'
                            : (isWeekend ? 'text-gray-400' : 'text-gray-900')
                            }
                        `}>
                            {day}
                        </div>

                        {/* Tags/Badges */}
                        {isToday && (
                        <span className="text-[10px] font-bold text-blue-600">
                            今天
                        </span>
                        )}
                        {isRest && (
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold border border-green-200">
                            休
                        </div>
                        )}
                    </div>

                    {/* Schedule Content */}
                    <div className="flex-1 flex flex-col justify-center items-center gap-1 mt-1">
                        {schedule ? (
                        !isRest && schedule.shift_name ? (
                            <>
                            <div
                                className="px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm truncate w-full text-center"
                                style={{
                                backgroundColor: schedule.color || '#3b82f6',
                                }}
                            >
                                {schedule.shift_name}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium">
                                {schedule.start_time?.substring(0, 5)} - {schedule.end_time?.substring(0, 5)}
                            </div>
                            </>
                        ) : null
                        ) : (
                        <span className="text-[10px] text-gray-300 select-none">-</span>
                        )}
                    </div>
                    </div>
                )
                })}
            </div>
            </div>
        </div>

      </div>
    )
  }

  // 渲染详情模态框
  const renderDetailModal = () => {
    if (!showDetailModal || !selectedSchedule) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white bg-opacity-98 rounded-2xl shadow-2xl max-w-md w-full">
          {/* 模态框头部 */}
          <div
            className="px-6 py-5 flex items-center justify-between text-white rounded-t-2xl"
            style={{ backgroundColor: selectedSchedule.color || '#3b82f6' }}
          >
            <div>
              <h3 className="text-2xl font-bold">排班详情</h3>
              <p className="text-base opacity-95 mt-1.5">{selectedSchedule.schedule_date}</p>
            </div>
            <button
              onClick={() => setShowDetailModal(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-25 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 模态框内容 */}
          <div className="p-6 space-y-5">
            {selectedSchedule.is_rest_day ? (
              <div className="bg-gray-50 bg-opacity-80 rounded-xl p-5">
                <div className="text-base text-gray-600 mb-2 font-medium">班次名称</div>
                <div className="text-xl font-bold text-gray-800">休息</div>
              </div>
            ) : selectedSchedule.shift_name ? (
              <>
                <div className="bg-gray-50 bg-opacity-80 rounded-xl p-5">
                  <div className="text-base text-gray-600 mb-2 font-medium">班次名称</div>
                  <div className="text-xl font-bold text-gray-800">{selectedSchedule.shift_name}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 bg-opacity-80 rounded-xl p-5">
                    <div className="text-base text-gray-600 mb-2 font-medium">上班时间</div>
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-6 h-6 text-green-600" />
                      <span className="text-xl font-bold text-gray-800">{selectedSchedule.start_time?.substring(0, 5)}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 bg-opacity-80 rounded-xl p-5">
                    <div className="text-base text-gray-600 mb-2 font-medium">下班时间</div>
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-6 h-6 text-blue-600" />
                      <span className="text-xl font-bold text-gray-800">{selectedSchedule.end_time?.substring(0, 5)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-7xl mb-4">📅</div>
                <div className="text-2xl font-bold text-gray-700">未排班</div>
                <div className="text-lg text-gray-600 mt-3">该日期暂无排班安排</div>
              </div>
            )}
          </div>

          {/* 模态框底部 */}
          <div className="px-6 py-4 bg-gray-50 bg-opacity-70 rounded-b-2xl flex justify-end">
            <button
              onClick={() => setShowDetailModal(false)}
              className="px-5 py-2.5 bg-gray-200 bg-opacity-90 text-gray-700 text-base font-medium rounded-lg hover:bg-gray-300 hover:shadow-md transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 pb-20">
          {/* 页面标题 */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 text-white">
                    <CalendarIcon className="w-6 h-6" />
                </div>
                我的排班
              </h1>
              <p className="text-sm text-gray-500 mt-1 ml-1">查看您的工作安排和考勤计划</p>
            </div>
          </div>

          {/* 日历视图 */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4 text-sm font-medium">加载排班数据...</p>
            </div>
          ) : (
            renderCalendarView()
          )}

          {/* 详情模态框 */}
          {renderDetailModal()}
          {renderStatistics()}
        </div>
      </div>
    </div>
  )
}
