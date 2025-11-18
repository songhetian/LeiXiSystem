import React, { useState, useMemo } from 'react'
import NotificationBadge from './NotificationBadge'

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  const [expandedMenus, setExpandedMenus] = useState(['user', 'org'])

  const menuItems = useMemo(() => {
    const isAdmin = user?.username === 'admin' || user?.real_name?.includes('管理员');

    const allItems = [
      {
        id: 'user',
        label: '员工管理',
        icon: '👥',
        children: [
          { id: 'user-employee', label: '员工管理', icon: '👨‍💼' },
          { id: 'user-changes', label: '变动记录', icon: '📋' },
          { id: 'user-approval', label: '员工审核', icon: '✅' },
          { id: 'user-reset-password', label: '重置密码', icon: '🔑' },
          { id: 'user-permission', label: '权限管理', icon: '🔐', admin: true },
        ],
      },
      // ... (other menu items remain the same)
      {
        id: 'notifications',
        label: '消息通知',
        icon: '🔔',
        children: [
          { id: 'notification-center', label: '通知中心', icon: '✉️' },
          { id: 'notification-management', label: '通知管理', icon: '🛠️', admin: true },
        ],
      },
    ];

    // Filter out admin-only items if the user is not an admin
    return allItems.map(item => {
      if (item.children) {
        item.children = item.children.filter(child => !child.admin || isAdmin);
      }
      return item;
    }).filter(item => !item.admin || isAdmin);
  }, [user]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    )
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto">
        {/* 头部 */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">雷犀客服系统</h1>
          <p className="text-gray-500 text-xs mt-1">Desktop Edition</p>
        </div>

        {/* 用户信息 */}
        <div className="mb-6 p-3 bg-primary-50 rounded-lg border border-primary-100">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-lg text-white">
                {user?.real_name?.charAt(0) || '用'}
              </div>
              <NotificationBadge onNavigate={setActiveTab} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-gray-800">{user?.real_name || '用户'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.username}</p>
            </div>
          </div>
        </div>

        {/* 菜单 */}
        <nav className="space-y-1">
          {allMenuItems.map(item => (
            <div key={item.id}>
              {/* 一级菜单 */}
              <button
                onClick={() => item.children ? toggleMenu(item.id) : setActiveTab(item.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-all text-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                {item.children && (
                  <span className={`text-xs transition-transform text-gray-400 ${expandedMenus.includes(item.id) ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                )}
              </button>

              {/* 二级菜单 */}
              {item.children && expandedMenus.includes(item.id) && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => setActiveTab(child.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        activeTab === child.id
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{child.icon}</span>
                      <span>{child.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* 底部 */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={onLogout}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
        >
          退出登录
        </button>
        <div className="text-xs text-gray-400 text-center">
          © 2024 雷犀客服系统
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
