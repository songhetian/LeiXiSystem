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
      activeChatId: null, // 当前活跃的聊天窗口 ID
      notificationEnabled: true,
      systemNotificationEnabled: true,

      // --- Actions ---
      
      // 设置当前活跃聊天
      setActiveChatId: (id) => set({ activeChatId: id }),
      
      // 更新未读总数 (内部辅助方法)
      _recalculateTotal: (contacts) => {
        const total = Array.isArray(contacts) 
          ? contacts.reduce((sum, g) => sum + (g.is_muted ? 0 : (g.unread_count || 0)), 0)
          : 0;
        set({ totalUnreadCount: total });
      },

      // 显式设置总数 (供 App.jsx 初始化使用)
      setTotalUnreadCount: (count) => set({ totalUnreadCount: count }),

      // 设置联系人列表 (自动更新总数)
      setContacts: (contacts) => {
        const cleanContacts = Array.isArray(contacts) ? contacts : [];
        set({ contacts: cleanContacts });
        get()._recalculateTotal(cleanContacts);
      },
      
      // 处理新消息流入 (智能判断：如果是当前活跃窗口，则不计未读)
      handleNewMessage: (msg, currentUserId) => set((state) => {
        const msgSenderId = String(msg.sender_id);
        const myId = String(currentUserId);
        
        // 关键修复：只要是自己发的，或者是当前正在看的群，未读数必须是 0
        const isMe = msgSenderId === myId && myId !== 'undefined' && myId !== 'null';
        const isActive = String(msg.group_id) === String(state.activeChatId);
        
        const index = state.contacts.findIndex(c => String(c.id) === String(msg.group_id));
        if (index === -1) return state;

        const newContacts = [...state.contacts];
        const group = { ...newContacts[index] };
        
        // 🛡️ 智能识别消息类型并显示对应摘要
        const mType = msg.msg_type || msg.type; // 兼容不同来源的字段名
        if (mType === 'image') {
          group.last_message = '[图片]';
        } else if (mType === 'file') {
          group.last_message = '[文件]';
        } else if (mType === 'voice') {
          group.last_message = '[语音]';
        } else if (mType === 'video') {
          group.last_message = '[视频]';
        } else {
          group.last_message = msg.content || '暂无消息内容';
        }

        group.last_message_time = msg.created_at || new Date().toISOString();
        
        if (isMe || isActive) {
            group.unread_count = 0; // 强制抹零
            group.has_mention = false;
        } else {
            // 只有别人在后台发消息时才增加计数
            group.unread_count = (group.unread_count || 0) + 1;
        }

        newContacts.splice(index, 1);
        newContacts.unshift(group);

        return { 
          contacts: newContacts,
          totalUnreadCount: newContacts.reduce((sum, g) => sum + (g.is_muted ? 0 : (g.unread_count || 0)), 0)
        };
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
