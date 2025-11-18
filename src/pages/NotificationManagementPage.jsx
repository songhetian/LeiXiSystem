import React from 'react';
import NotificationSender from '../components/NotificationSender';
import NotificationHistory from '../components/NotificationHistory';

const NotificationManagementPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">通知管理</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <NotificationSender />
        </div>
        <div>
          <NotificationHistory />
        </div>
      </div>
    </div>
  );
};

export default NotificationManagementPage;
