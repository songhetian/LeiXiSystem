import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import Modal from './Modal'
import { getApiUrl } from '../utils/apiConfig'

function EmployeeDetail({ employee, isOpen, onClose, departments }) {
  const [employeeChanges, setEmployeeChanges] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employee && isOpen) {
      fetchEmployeeChanges()
    }
  }, [employee, isOpen])

  const fetchEmployeeChanges = async () => {
    if (!employee?.id) return

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/employee-changes/${employee.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setEmployeeChanges(data)
      }
    } catch (error) {
      console.error('获取员工变动记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTenureFromChanges = () => {
    if (!employeeChanges || employeeChanges.length === 0) {
      return calculateTenure(employee.hire_date)
    }

    const hireRecord = employeeChanges.find(c => c.change_type === 'hire')
    if (!hireRecord) {
      return calculateTenure(employee.hire_date)
    }

    const hireDate = new Date(hireRecord.change_date)
    const resignRecord = employeeChanges.find(c => ['resign', 'terminate'].includes(c.change_type))
    const endDate = resignRecord ? new Date(resignRecord.change_date) : new Date()

    const diffTime = Math.abs(endDate - hireDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365)
    const months = Math.floor((diffDays % 365) / 30)
    const days = diffDays % 30

    if (years > 0) {
      return `${years}年${months}个月`
    } else if (months > 0) {
      return `${months}个月${days}天`
    } else {
      return `${days}天`
    }
  }

  const calculateTenure = (hireDate) => {
    if (!hireDate) return '-'
    const hire = new Date(hireDate)
    const now = new Date()
    const diffTime = Math.abs(now - hire)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365)
    const months = Math.floor((diffDays % 365) / 30)
    return `${years}年${months}个月`
  }

  const getHistoricalDepartments = () => {
    if (!employeeChanges || employeeChanges.length === 0) return []

    const deptHistory = []
    const seenDepts = new Set()

    const sortedChanges = [...employeeChanges].sort((a, b) =>
      new Date(a.change_date) - new Date(b.change_date)
    )

    sortedChanges.forEach((change, index) => {
      if (change.new_department_name && !seenDepts.has(change.new_department_name)) {
        seenDepts.add(change.new_department_name)

        const startDate = new Date(change.change_date)
        let endDate = new Date()

        const nextChange = sortedChanges.slice(index + 1).find(c =>
          (c.new_department_name && c.new_department_name !== change.new_department_name) ||
          ['resign', 'terminate'].includes(c.change_type)
        )

        if (nextChange) {
          endDate = new Date(nextChange.change_date)
        }

        const diffTime = Math.abs(endDate - startDate)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const years = Math.floor(diffDays / 365)
        const months = Math.floor((diffDays % 365) / 30)
        const days = diffDays % 30

        let tenure = ''
        if (years > 0) {
          tenure = `${years}年${months}个月`
        } else if (months > 0) {
          tenure = `${months}个月${days}天`
        } else {
          tenure = `${days}天`
        }

        deptHistory.push({
          name: change.new_department_name,
          date: change.change_date,
          type: change.change_type,
          tenure: tenure,
          isCurrent: !nextChange
        })
      }
    })

    return deptHistory
  }

  const renderRating = (rating) => {
    return `${rating}星`
  }

  if (!employee) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="large">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 1px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>

      <div>
        {/* 头部 - 莫兰迪色系(加深) */}
        <div className="bg-gradient-to-r from-sky-200/80 to-indigo-200/80 -mx-6 -mt-4 px-5 py-3 mb-4 border-b border-sky-300/70">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-white/95 shadow-sm flex items-center justify-center text-lg font-semibold text-indigo-700 overflow-hidden flex-shrink-0 border border-indigo-300/60">
              {employee.avatar ? (
                <img src={employee.avatar} alt={employee.real_name} className="w-full h-full object-cover" />
              ) : (
                employee.real_name?.charAt(0) || '员'
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-base font-semibold text-slate-800">{employee.real_name}</h3>
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                  employee.status === 'active' ? 'bg-emerald-200/90 text-emerald-800 border border-emerald-400/70' :
                  employee.status === 'resigned' ? 'bg-rose-200/90 text-rose-800 border border-rose-400/70' :
                  'bg-slate-200/90 text-slate-700 border border-slate-400/70'
                }`}>
                  {employee.status === 'active' ? '在职' : employee.status === 'resigned' ? '离职' : '停用'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-1.5">{employee.position || '未设置职位'}</p>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">工号</span>
                  <span className="font-medium text-slate-800">{employee.employee_no}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">评级</span>
                  <span className="font-medium text-slate-800">{renderRating(employee.rating || 3)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">在职</span>
                  <span className="font-medium text-slate-800">{calculateTenureFromChanges()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1.5 border-b border-gray-200">基本信息</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <div className="flex items-center">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">所属部门</span>
              <span className="text-xs text-gray-800 font-medium">
                {departments.find(d => d.id === employee.department_id)?.name || '-'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">入职日期</span>
              <span className="text-xs text-gray-800 font-medium">
                {employee.hire_date ? formatDate(employee.hire_date) : '-'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">学历</span>
              <span className="text-xs text-gray-800 font-medium">{employee.education || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">手机号</span>
              <span className="text-xs text-gray-800 font-medium">{employee.phone || '-'}</span>
            </div>
            <div className="flex items-center col-span-2">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">邮箱</span>
              <span className="text-xs text-gray-800 font-medium">{employee.email || '-'}</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1.5 border-b border-gray-200">联系信息</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <div className="flex items-center">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">紧急联系人</span>
              <span className="text-xs text-gray-800 font-medium">{employee.emergency_contact || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">紧急电话</span>
              <span className="text-xs text-gray-800 font-medium">{employee.emergency_phone || '-'}</span>
            </div>
            <div className="flex items-center col-span-2">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">家庭住址</span>
              <span className="text-xs text-gray-800 font-medium">{employee.address || '-'}</span>
            </div>
          </div>
        </div>

        {employee.skills && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-1.5 border-b border-gray-200">技能特长</h4>
            <p className="text-xs text-gray-700 leading-relaxed">{employee.skills}</p>
          </div>
        )}

        {getHistoricalDepartments().length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary-500">工作经历</h4>
            <div className="space-y-4">
              {getHistoricalDepartments().map((dept, index) => (
                <div key={index} className="relative pl-8 pb-4 border-l-2 border-gray-300 last:border-l-0 last:pb-0">
                  <div className="absolute left-0 top-0 w-4 h-4 -ml-[9px] rounded-full bg-primary-500 border-2 border-white"></div>
                  <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h5 className="font-bold text-gray-900 text-lg">{dept.name}</h5>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(dept.date)}
                          {dept.type === 'hire' && ' · 入职'}
                          {dept.type === 'transfer' && ' · 调动'}
                          {dept.isCurrent && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              当前部门
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-sm font-semibold rounded-full">
                          {dept.tenure}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {employeeChanges.length > 0 && (() => {
          // 将变动记录按工作周期分组
          const sortedChanges = [...employeeChanges].sort((a, b) => new Date(a.change_date) - new Date(b.change_date))
          const workPeriods = []
          let currentPeriod = []

          sortedChanges.forEach((change, index) => {
            currentPeriod.push(change)

            // 如果是离职记录，或者是最后一条记录，结束当前周期
            if (['resign', 'terminate'].includes(change.change_type) || index === sortedChanges.length - 1) {
              workPeriods.push([...currentPeriod])
              currentPeriod = []
            }
          })

          return (
            <div className="mb-6">
              <h4 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary-500">工作周期</h4>
              <div className="space-y-4">
                {workPeriods.map((period, periodIndex) => {
                  const startChange = period[0]
                  const endChange = period[period.length - 1]
                  const isResigned = ['resign', 'terminate'].includes(endChange.change_type)

                  // 计算整个周期的时长
                  const startDate = new Date(startChange.change_date)
                  const endDate = isResigned ? new Date(endChange.change_date) : new Date()
                  const diffTime = Math.abs(endDate - startDate)
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                  const years = Math.floor(diffDays / 365)
                  const months = Math.floor((diffDays % 365) / 30)
                  const days = diffDays % 30

                  let totalTenure = ''
                  if (years > 0) {
                    totalTenure = `${years}年${months}个月`
                  } else if (months > 0) {
                    totalTenure = `${months}个月${days}天`
                  } else {
                    totalTenure = `${days}天`
                  }

                  return (
                    <div key={periodIndex} className="border-2 border-gray-300 rounded-lg p-5 bg-white hover:shadow-md transition-shadow">
                      {/* 周期头部 */}
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-900">
                            第 {periodIndex + 1} 个工作周期
                          </span>
                          {!isResigned && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              当前在职
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">总时长</div>
                          <span className="inline-block px-3 py-1 bg-primary-500 text-white text-sm font-bold rounded-full">
                            {totalTenure}
                          </span>
                        </div>
                      </div>

                      {/* 周期内的所有变动 */}
                      <div className="space-y-3">
                        {period.map((change, changeIndex) => {
                          // 计算每段的时长
                          const segmentStart = new Date(change.change_date)
                          let segmentEnd = new Date()

                          if (changeIndex < period.length - 1) {
                            segmentEnd = new Date(period[changeIndex + 1].change_date)
                          } else if (!isResigned) {
                            segmentEnd = new Date()
                          } else {
                            segmentEnd = new Date(change.change_date)
                          }

                          const segmentDiffTime = Math.abs(segmentEnd - segmentStart)
                          const segmentDays = Math.ceil(segmentDiffTime / (1000 * 60 * 60 * 24))
                          const segmentYears = Math.floor(segmentDays / 365)
                          const segmentMonths = Math.floor((segmentDays % 365) / 30)
                          const segmentDaysRem = segmentDays % 30

                          let segmentTenure = ''
                          if (!['resign', 'terminate'].includes(change.change_type)) {
                            if (segmentYears > 0) {
                              segmentTenure = `${segmentYears}年${segmentMonths}个月`
                            } else if (segmentMonths > 0) {
                              segmentTenure = `${segmentMonths}个月${segmentDaysRem}天`
                            } else {
                              segmentTenure = `${segmentDaysRem}天`
                            }
                          }

                          return (
                            <div key={change.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                              <div className="flex-shrink-0 pt-1">
                                <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                                  change.change_type === 'hire' ? 'bg-green-500 text-white' :
                                  change.change_type === 'transfer' ? 'bg-blue-500 text-white' :
                                  change.change_type === 'promotion' ? 'bg-purple-500 text-white' :
                                  change.change_type === 'resign' ? 'bg-orange-500 text-white' :
                                  'bg-red-500 text-white'
                                }`}>
                                  {change.change_type === 'hire' ? '入职' :
                                   change.change_type === 'transfer' ? '调动' :
                                   change.change_type === 'promotion' ? '晋升' :
                                   change.change_type === 'resign' ? '辞职' : '离职'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-sm font-bold text-gray-900">
                                    {formatDate(change.change_date)}
                                  </div>
                                  {segmentTenure && (
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                                      {segmentTenure}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-700">
                                  {change.change_type === 'hire' && (
                                    <span>入职 <span className="font-semibold">{change.new_department_name}</span> - {change.new_position || '未指定职位'}</span>
                                  )}
                                  {change.change_type === 'transfer' && (
                                    <span><span className="font-semibold">{change.old_department_name}</span> → <span className="font-semibold">{change.new_department_name}</span></span>
                                  )}
                                  {change.change_type === 'promotion' && (
                                    <span><span className="font-semibold">{change.old_position}</span> → <span className="font-semibold">{change.new_position}</span></span>
                                  )}
                                  {['resign', 'terminate'].includes(change.change_type) && (
                                    <span>离开 <span className="font-semibold">{change.old_department_name}</span></span>
                                  )}
                                </div>
                                {change.reason && (
                                  <div className="text-xs text-gray-600 mt-2 italic bg-white px-2 py-1 rounded">
                                    {change.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {employee.remark && (
          <div className="mb-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary-500">备注</h4>
            <p className="text-gray-900 leading-relaxed bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              {employee.remark}
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2">加载变动记录中...</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 mt-4 border-t border-sky-300/70 -mx-6 px-6 -mb-6 pb-6 bg-sky-100/80">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium shadow-sm"
        >
          关闭
        </button>
      </div>
    </Modal>
  )
}

export default EmployeeDetail
