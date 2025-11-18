import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getApiUrl } from '../utils/apiConfig';

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    receiveSystemNotifications: true,
    receiveDepartmentNotifications: true,
    notificationSound: true,
    doNotDisturbStart: '22:00',
    doNotDisturbEnd: '08:00',
  });
  const [loading, setLoading] = useState(false);

  // Fetch settings from backend and cache locally
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/api/user/notification-settings'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('加载通知设置失败');
        const json = await response.json();
        const data = json.data || {};
        setSettings({
          receiveSystemNotifications: !!data.receiveSystemNotifications,
          receiveDepartmentNotifications: !!data.receiveDepartmentNotifications,
          notificationSound: !!data.notificationSound,
          doNotDisturbStart: data.doNotDisturbStart || '22:00',
          doNotDisturbEnd: data.doNotDisturbEnd || '08:00',
          toastDuration: data.toastDuration || 5000,
        });
        localStorage.setItem('notificationSettings', JSON.stringify({
          receiveSystemNotifications: !!data.receiveSystemNotifications,
          receiveDepartmentNotifications: !!data.receiveDepartmentNotifications,
          notificationSound: !!data.notificationSound,
          doNotDisturbStart: data.doNotDisturbStart || '22:00',
          doNotDisturbEnd: data.doNotDisturbEnd || '08:00',
          toastDuration: data.toastDuration || 5000,
        }));
      } catch (error) {
        toast.error(`加载设置失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSettingChange = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings((prevSettings) => ({
      ...prevSettings,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/user/notification-settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('保存通知设置失败');
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
      toast.success('通知设置已保存');
    } catch (error) {
      toast.error(`保存设置失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">通知设置</h2>

      <div className="space-y-6">
        {/* 系统通知 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <label htmlFor="receiveSystemNotifications" className="text-gray-800 font-medium text-lg">
              接收系统通知
            </label>
            <p className="text-sm text-gray-500">开启后，您将收到系统发布的重要通知和公告。</p>
          </div>
          <input
            type="checkbox"
            id="receiveSystemNotifications"
            name="receiveSystemNotifications"
            checked={settings.receiveSystemNotifications}
            onChange={handleSettingChange}
            className="toggle toggle-primary"
          />
        </div>

        {/* 部门通知 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <label htmlFor="receiveDepartmentNotifications" className="text-gray-800 font-medium text-lg">
              接收部门通知
            </label>
            <p className="text-sm text-gray-500">开启后，您将收到您所在部门发布的通知。</p>
          </div>
          <input
            type="checkbox"
            id="receiveDepartmentNotifications"
            name="receiveDepartmentNotifications"
            checked={settings.receiveDepartmentNotifications}
            onChange={handleSettingChange}
            className="toggle toggle-primary"
          />
        </div>

        {/* 通知音效 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <label htmlFor="notificationSound" className="text-gray-800 font-medium text-lg">
              通知音效
            </label>
            <p className="text-sm text-gray-500">开启后，新通知到达时将播放提示音。</p>
          </div>
          <input
            type="checkbox"
            id="notificationSound"
            name="notificationSound"
            checked={settings.notificationSound}
            onChange={handleSettingChange}
            className="toggle toggle-primary"
          />
        </div>

        {/* 免打扰时间段 */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="block text-gray-800 font-medium text-lg mb-2">免打扰时间段</label>
          <p className="text-sm text-gray-500 mb-3">在此时间段内，您将不会收到任何通知提醒。</p>
          <div className="flex items-center space-x-4">
            <input
              type="time"
              name="doNotDisturbStart"
              value={settings.doNotDisturbStart}
              onChange={handleSettingChange}
              className="input input-bordered w-32"
            />
            <span>至</span>
            <input
              type="time"
              name="doNotDisturbEnd"
              value={settings.doNotDisturbEnd}
              onChange={handleSettingChange}
              className="input input-bordered w-32"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="btn btn-primary w-full mt-8"
        >
          {loading ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
