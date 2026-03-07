import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/apiConfig';
import { XMarkIcon, CalendarIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function CompensatoryLeaveModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    original_date: '',
    new_date: '',
    new_shift_id: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [originalShift, setOriginalShift] = useState(null);
  const [checkingSchedule, setCheckingSchedule] = useState(false);
  const [employeeId, setEmployeeId] = useState(null);

  // Load shifts on mount/open
  useEffect(() => {
    if (isOpen) {
      fetchShifts();
      setFormData({
        original_date: '',
        new_date: '',
        new_shift_id: '',
        reason: ''
      });
      setOriginalShift(null);
      // Fetch employee id for current user
      try {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (userStr && token) {
          const user = JSON.parse(userStr);
          axios
            .get(getApiUrl(`/api/employees/by-user/${user.id}`), {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => {
              if (res.data?.success && res.data?.data?.id) {
                setEmployeeId(res.data.data.id);
              } else {
                setEmployeeId(null);
              }
            })
            .catch(() => setEmployeeId(null));
        } else {
          setEmployeeId(null);
        }
      } catch {
        setEmployeeId(null);
      }
    }
  }, [isOpen]);

  // Check original schedule when date changes
  useEffect(() => {
    if (formData.original_date) {
      checkOriginalSchedule(formData.original_date);
    } else {
      setOriginalShift(null);
    }
  }, [formData.original_date]);

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      // Fetch all active shifts (limit 100 to be safe)
      const response = await axios.get(getApiUrl('/api/shifts'), {
        params: { is_active: 1, limit: 100 }
      });

      let shiftList = [];
      if (Array.isArray(response.data)) {
        shiftList = response.data;
      } else if (response.data.success && Array.isArray(response.data.data)) {
        shiftList = response.data.data;
      }

      setShifts(shiftList);
    } catch (error) {
      logger.error('Failed to fetch shifts:', error);
      toast.error('无法加载班次列表');
    } finally {
      setLoadingShifts(false);
    }
  };

  const checkOriginalSchedule = async (date) => {
    setCheckingSchedule(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const effectiveEmployeeId = employeeId || user.employee_id;

      // We need to check if there is a schedule for this day
      // Assuming an endpoint exists or we use /api/schedules query
      // If no specific endpoint, we trust the user or try to find it.
      // Let's try to query schedules.
      const response = await axios.get(getApiUrl('/api/schedules'), {
        params: {
            employee_id: effectiveEmployeeId,
            start_date: date,
            end_date: date
        }
      });

      if (response.data.success && response.data.data.length > 0) {
        setOriginalShift(response.data.data[0]);
      } else {
        setOriginalShift(null);
      }
    } catch (error) {
      logger.error('Error checking schedule:', error);
    } finally {
      setCheckingSchedule(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.original_date || !formData.new_date || !formData.new_shift_id || !formData.reason.trim()) {
       toast.error('请填写完整信息');
       return;
    }

    // Basic validation
    if (formData.original_date === formData.new_date) {
        toast.error('调休日期不能相同');
        return;
    }

    setSubmitting(true);
    try {
       const user = JSON.parse(localStorage.getItem('user') || '{}');
       const token = localStorage.getItem('token');
       // Ensure we have employee_id
       let effectiveEmployeeId = employeeId || user.employee_id;
       if (!effectiveEmployeeId && user.id && token) {
         try {
           const res = await axios.get(getApiUrl(`/api/employees/by-user/${user.id}`), {
             headers: { Authorization: `Bearer ${token}` },
           });
           if (res.data?.success && res.data?.data?.id) {
             effectiveEmployeeId = res.data.data.id;
             setEmployeeId(effectiveEmployeeId);
           }
         } catch {}
       }
       if (!effectiveEmployeeId || !user.id) {
         toast.error('未获取到用户信息，请重新登录后再试');
         return;
       }
       const payload = {
          employee_id: effectiveEmployeeId,
          user_id: user.id,
          original_schedule_date: formData.original_date,
          new_schedule_date: formData.new_date,
          new_shift_id: Number(formData.new_shift_id),
          reason: formData.reason
       };

       const response = await axios.post(getApiUrl('/api/compensatory/apply'), payload);
       if (response.data.success) {
          onSuccess();
          toast.success('申请提交成功', { position: 'top-center' });
       } else {
          toast.error(response.data.message || '提交失败');
       }
    } catch (error) {
       logger.error('Submit compensatory error:', error);
       toast.error(error.response?.data?.message || '提交失败');
    } finally {
       setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded shadow-xl max-w-lg w-full overflow-hidden transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50">          <div>
            <h2 className="text-xl font-bold text-gray-800">申请调休</h2>
            <p className="text-xs text-gray-500 mt-0.5">调整工作安排</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           {/* Original Date */}
           <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                 原工作日期 <span className="text-xs font-normal text-gray-500">(原本要上班)</span>
              </label>
              <div className="relative">
                 <input
                   type="date"
                   value={formData.original_date}
                   onChange={e => setFormData({...formData, original_date: e.target.value})}
                   className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                   required
                 />
                 <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* Original Shift Info */}
              {checkingSchedule ? (
                  <div className="text-xs text-blue-500 flex items-center gap-1">
                      <ArrowPathIcon className="w-3 h-3 animate-spin"/> 查询排班中...
                  </div>
              ) : originalShift ? (
                  <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100 flex items-center justify-between">
                      <span>当日排班: <strong>{originalShift.shift_name || '未知班次'}</strong></span>
                      <span>{originalShift.start_time?.slice(0,5)} - {originalShift.end_time?.slice(0,5)}</span>
                  </div>
              ) : formData.original_date ? (
                  <div className="text-xs bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg border border-yellow-100">
                      当日暂无排班记录，请确认日期
                  </div>
              ) : null}
           </div>

           <div className="flex items-center gap-4">
              <div className="h-px bg-gray-100 flex-1"></div>
              <div className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-full border border-gray-100">调换为</div>
              <div className="h-px bg-gray-100 flex-1"></div>
           </div>

           {/* New Date & Shift */}
           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                     补班日期
                  </label>
                  <div className="relative">
                     <input
                       type="date"
                       value={formData.new_date}
                       onChange={e => setFormData({...formData, new_date: e.target.value})}
                       className="w-full pl-10 pr-2 py-2.5 bg-gray-50 border border-gray-200 rounded focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                       required
                     />
                     <CalendarIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                     选择班次
                  </label>
                  <div className="relative">
                     <select
                       value={formData.new_shift_id}
                       onChange={e => setFormData({...formData, new_shift_id: e.target.value})}
                       className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none text-sm truncate"
                       required
                       disabled={loadingShifts}
                     >
                        <option value="">{loadingShifts ? '加载中...' : '选择班次'}</option>
                        {shifts.map(shift => (
                           <option key={shift.id} value={shift.id}>
                              {shift.name} ({shift.start_time?.slice(0,5)}-{shift.end_time?.slice(0,5)})
                           </option>
                        ))}
                     </select>
                     <ClockIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                     </div>
                  </div>
               </div>
           </div>

           {/* Reason */}
           <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                 申请理由
              </label>
              <textarea
                 value={formData.reason}
                 onChange={e => setFormData({...formData, reason: e.target.value})}
                 rows={3}
                 className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-sm"
                 placeholder="请详细说明调休原因..."
                 required
              />
           </div>

           <div className="pt-4 flex justify-end gap-3 border-t border-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors font-medium text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded transition-all font-medium text-sm shadow-lg disabled:opacity-70 flex items-center gap-2"
              >
                {submitting ? '提交中...' : '提交申请'}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
