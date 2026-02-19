import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 全局即时通讯状态管理
 */
export const useChatStore = create(
  persist(
    (set, get) => ({
      // --- 数据状态 ---
      totalUnreadCount: 0,
      contacts: [],
      notificationEnabled: true, // 是否开启全局通知
      systemNotificationEnabled: true, // 是否开启系统级(桌面)通知

      // --- Actions ---
      
      // 更新未读总数
      setTotalUnreadCount: (count) => set({ totalUnreadCount: count }),
      
      // 增加未读数
      incrementUnreadCount: () => set((state) => ({ totalUnreadCount: state.totalUnreadCount + 1 })),
      
      // 设置联系人列表
      setContacts: (contacts) => set({ contacts }),
      
      // 更新单个联系人状态
      updateContact: (groupId, updates) => set((state) => {
        const index = state.contacts.findIndex(c => String(c.id) === String(groupId));
        if (index === -1) return state;
        
        const newContacts = [...state.contacts];
        newContacts[index] = { ...newContacts[index], ...updates };
        
        // 如果有消息更新，自动置顶
        if (updates.last_message_time) {
          const [item] = newContacts.splice(index, 1);
          newContacts.unshift(item);
        }
        
        return { contacts: newContacts };
      }),

      // 切换通知开关
      toggleNotification: (enabled) => set({ notificationEnabled: enabled }),
      
      // 切换系统桌面通知开关
      toggleSystemNotification: (enabled) => set({ systemNotificationEnabled: enabled }),

      // 获取通知设置
      getSettings: () => ({
        enabled: get().notificationEnabled,
        systemEnabled: get().systemNotificationEnabled
      })
    }),
    {
      name: 'leixi-chat-storage', // 存储到 localStorage
      partialize: (state) => ({ 
        notificationEnabled: state.notificationEnabled,
        systemNotificationEnabled: state.systemNotificationEnabled
      }), // 仅持久化设置，不持久化消息数据以防过时
    }
  )
)
