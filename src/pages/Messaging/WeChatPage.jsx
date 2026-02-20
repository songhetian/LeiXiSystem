import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  SearchOutlined,
  PlusOutlined,
  UserOutlined,
  TeamOutlined,
  MoreOutlined,
  SmileOutlined,
  PictureOutlined,
  FileOutlined,
  SendOutlined,
  CloseOutlined,
  BellOutlined,
  AudioMutedOutlined
} from '@ant-design/icons';
import { message, Modal, Upload, Avatar, Badge, Tooltip, Image, Drawer, List, Mentions } from 'antd';
import { tokenManager, apiGet, apiPost } from '../../utils/apiClient';
import { getWsBaseUrl, getApiUrl, getFileUrl } from '../../utils/apiConfig';
import { wsManager } from '../../services/websocket';
import { useChatStore } from '../../hooks/useChatStore';

const { Option } = Mentions;

// --- 性能优化：消息条目组件 Memo 化 ---
const ChatMessage = React.memo(({ msg, currentUser, getFileUrl }) => {
  if (msg.msg_type === 'system' || msg.sender_id === 0) {
    return (
      <div className="flex justify-center my-2">
        <span className="bg-gray-200/50 text-gray-500 text-[10px] px-3 py-0.5 rounded-full uppercase italic">
          {msg.content}
        </span>
      </div>
    );
  }

  const isMe = String(msg.sender_id) === String(currentUser?.id);
  const myName = currentUser?.real_name || currentUser?.name;
  const amIMentioned = msg.content && myName && msg.content.includes(`@${myName}`);

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
      {!isMe && (
        <Avatar 
          src={getFileUrl(msg.sender_avatar)} 
          className="mr-2 mt-1 flex-shrink-0" 
          size="small" 
          icon={<UserOutlined />} 
        />
      )}
      <div className="max-w-[70%]">
        {!isMe && <div className="text-xs text-gray-400 mb-1 ml-1">{msg.sender_name}</div>}
        <div className={`px-4 py-2 rounded-lg text-sm relative break-words shadow-sm ${
          isMe ? 'bg-[#95ec69] text-black' : 
          (amIMentioned ? 'bg-amber-100 border border-amber-200 text-amber-900 ring-2 ring-amber-400 ring-opacity-20' : 'bg-white text-gray-800')
        }`}>
          {msg.msg_type === 'image' ? (
            <Image src={getFileUrl(msg.file_url)} className="rounded-md" style={{ maxHeight: '200px' }} />
          ) : msg.msg_type === 'file' ? (
            <a href={getFileUrl(msg.file_url)} target="_blank" rel="noopener noreferrer" className="flex items-center underline">
              <FileOutlined className="mr-2"/> {msg.content}
            </a>
          ) : msg.content}
        </div>
      </div>
      {isMe && (
        <Avatar 
          src={getFileUrl(currentUser?.avatar)} 
          className="ml-2 mt-1 flex-shrink-0" 
          size="small" 
          icon={<UserOutlined />} 
        />
      )}
    </div>
  );
});

// --- 性能优化：联系人条目组件 Memo 化 ---
const ContactItem = React.memo(({ g, isActive, onClick, getFileUrl }) => (
  <div 
    onClick={() => onClick(g)} 
    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
      isActive ? 'bg-[#c6c6c6] shadow-sm' : 'hover:bg-green-50'
    }`}
  >
    <Badge count={g.is_muted ? 0 : (g.unread_count || 0)} dot={g.is_muted && g.unread_count > 0} size="small" offset={[-5, 5]}>
       <Avatar shape="square" icon={<TeamOutlined />} className="bg-green-600" src={getFileUrl(g.avatar)} />
    </Badge>
    <div className="ml-3 font-medium text-gray-800 flex-1 truncate">
        <div className="flex justify-between items-center">
            <span className="truncate">{g.name}</span>
            {g.last_message_time && (
              <span className="text-[10px] text-gray-400">
                {new Date(g.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
        </div>
        <div className="text-xs text-gray-500 truncate">
            {g.has_mention && <span className="text-red-500 font-bold mr-1">[有人@我]</span>}
            {g.last_message || '暂无消息'}
        </div>
    </div>
  </div>
));

// Simple UI Components
const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "bg-[#07c160] text-white hover:bg-[#06ad56] focus:ring-green-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
    destructive: "bg-red-500 text-white hover:bg-red-600"
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

// --- 性能优化：将输入框拆分为独立组件，防止打字时触发整个页面的全量重绘 ---
const ChatInput = React.memo(({ onSend, currentGroupMembers, currentUser, handleFileUpload }) => {
  const [text, setText] = useState('');

  const handlePressEnter = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!text.trim()) return;
      onSend(text);
      setText('');
    }
  };

  return (
    <div className="bg-[#f5f5f5] border-t border-[#e7e7e7] p-4">
      <div className="flex items-center gap-5 mb-3 px-2 text-gray-500">
        <Upload beforeUpload={handleFileUpload} showUploadList={false} accept="image/*">
          <PictureOutlined className="text-xl hover:text-[#07c160] cursor-pointer" />
        </Upload>
        <Upload beforeUpload={handleFileUpload} showUploadList={false}>
          <FileOutlined className="text-xl hover:text-[#07c160] cursor-pointer" />
        </Upload>
      </div>
      <Mentions 
        autoSize={{ minRows: 2, maxRows: 6 }} 
        className="w-full bg-transparent border-none focus:ring-0 text-sm p-2 shadow-none resize-none" 
        placeholder="发送消息..." 
        value={text} 
        onChange={setText} 
        onKeyDown={handlePressEnter} 
        options={currentGroupMembers
          .filter(m => m.id !== currentUser?.id)
          .map(m => ({ value: m.name, label: m.name, key: m.id }))
        } 
      />
      <div className="flex justify-between items-center mt-2">
        <div className="text-xs text-gray-400">Enter 发送, @ 提醒成员</div>
        <Button onClick={() => { if(text.trim()) { onSend(text); setText(''); } }}>发送</Button>
      </div>
    </div>
  );
});

const WeChatPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const { 
    contacts, 
    setContacts, 
    updateContact, 
    totalUnreadCount, 
    setTotalUnreadCount 
  } = useChatStore();
  
  const [activeChat, setActiveChat] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);
  const [currentGroupMembers, setCurrentGroupMembers] = useState([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const activeChatRef = useRef(null);

  const isAdmin = useMemo(() => currentUser?.role === '超级管理员' || currentUser?.role === 'admin', [currentUser]);

  useEffect(() => {
    const token = tokenManager.getToken();
    if (!token) return;
    
    // 优先从解析的 Token 获取基础信息
    const decodedUser = tokenManager.parseToken(token);
    
    // 补全头像：Token 可能不包含大体积的 Base64 头像，尝试从 localStorage 获取完整 user 对象
    const savedUserStr = localStorage.getItem('user');
    let finalUser = { ...decodedUser };
    
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        if (String(savedUser.id) === String(decodedUser.id)) {
          finalUser = { ...savedUser, ...decodedUser, avatar: savedUser.avatar || decodedUser.avatar };
        }
      } catch (e) { console.error('解析本地用户信息失败', e); }
    }
    
    setCurrentUser(finalUser);
    fetchContacts();

    const handleMemberUpdate = (data) => {
        if (activeChatRef.current && String(data.groupId) === String(activeChatRef.current.id)) {
            fetchMembers(data.groupId);
        }
    };

    const handleChatMessage = (msg) => {
        const currentChat = activeChatRef.current;
        const myName = currentUser?.real_name || currentUser?.name;
        const isMentioned = msg.content && myName && msg.content.includes(`@${myName}`);

        // 1. 如果是当前聊天窗口
        if (currentChat && String(msg.group_id) === String(currentChat.id)) {
             setMessages(prev => [...prev, msg]);
             // 性能优化：改用 Socket 标记已读
             if (wsManager.socket) wsManager.socket.emit('mark_read', currentChat.id);
             setTimeout(scrollToBottom, 50);
        } else {
            // 2. 如果不是当前窗口，显示通知（App.jsx 已经处理了全局 Toast，这里处理组件内逻辑）
            if (document.hidden || !currentChat || String(currentChat.id) !== String(msg.group_id)) {
                showNotification(msg); 
            }
        }

        // 3. 更新侧边栏联系人列表（置顶、最后消息）
        setContacts(prev => {
            const isCurrent = currentChat && String(msg.group_id) === String(currentChat.id);
            const index = prev.findIndex(g => String(g.id) === String(msg.group_id));
            if (index === -1) return prev;

            const updated = [...prev];
            const group = { ...updated[index] };
            group.last_message = msg.msg_type === 'text' ? msg.content : (msg.msg_type === 'image' ? '[图片]' : '[文件]');
            group.last_message_time = msg.created_at;
            
            if (!isCurrent) {
                group.unread_count = (group.unread_count || 0) + 1;
                group.has_mention = group.has_mention || isMentioned;
            }

            updated.splice(index, 1);
            return [group, ...updated];
        });
    };

    wsManager.on('member_update', handleMemberUpdate);
    wsManager.on('chat_message', handleChatMessage);

    return () => {
      wsManager.off('member_update', handleMemberUpdate);
      wsManager.off('chat_message', handleChatMessage);
    };
  }, []);

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const fetchContacts = async () => {
    try {
      const res = await apiGet('/api/chat/contacts');
      if (res.success) {
        setContacts(res.data);
        const total = res.data.reduce((sum, g) => sum + (g.is_muted ? 0 : (g.unread_count || 0)), 0);
        setTotalUnreadCount(total);
      }
    } catch (err) { message.error('加载群组失败'); }
  };

  const fetchHistory = async (chat, beforeId = null) => {
    if (isLoadingMore) return;
    const limit = 30;
    const isInitial = beforeId === null;
    if (!isInitial) setIsLoadingMore(true);

    try {
      const url = `/api/chat/history?targetId=${chat.id}&targetType=group&limit=${limit}${beforeId ? `&beforeId=${beforeId}` : ''}`;
      const res = await apiGet(url);
      if (res.success) {
        const newMsgs = res.data;
        if (isInitial) {
            setMessages(newMsgs);
            setHasMore(newMsgs.length === limit);
            if (newMsgs.length > 0) {
                // 性能优化：改用 Socket 标记已读
                if (wsManager.socket) wsManager.socket.emit('mark_read', chat.id);
            }
            setTimeout(scrollToBottom, 100);
        } else {
            const container = scrollContainerRef.current;
            const oldScrollHeight = container.scrollHeight;
            setMessages(prev => [...newMsgs, ...prev]);
            setHasMore(newMsgs.length === limit);
            setIsLoadingMore(false);
            setTimeout(() => { if (container) container.scrollTop = container.scrollHeight - oldScrollHeight; }, 0);
        }
      }
    } catch (err) { setIsLoadingMore(false); }
  };

  const handleScroll = (e) => {
      if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingMore && activeChat && messages.length > 0) {
          fetchHistory(activeChat, messages[0].id);
      }
  };

  const fetchMembers = async (groupId) => {
    try {
      const res = await apiGet(`/api/chat/groups/${groupId}/members`);
      if (res.success) setCurrentGroupMembers(res.data);
    } catch (err) {}
  };

  const toggleMute = async (groupId, currentMute) => {
      try {
          const res = await apiPost('/api/chat/mute', { groupId, isMuted: !currentMute });
          if (res.success) {
              setContacts(contacts.map(c => c.id === groupId ? { ...c, is_muted: !currentMute } : c));
              if (activeChat?.id === groupId) setActiveChat(prev => ({ ...prev, is_muted: !currentMute }));
              message.success(!currentMute ? '已开启免打扰' : '已关闭免打扰');
          }
      } catch (err) { message.error('操作失败'); }
  };

  const showNotification = (msg) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const group = contacts.find(c => String(c.id) === String(msg.group_id));
      const myName = currentUser?.real_name || currentUser?.name;
      const isMentioned = msg.content && myName && msg.content.includes(`@${myName}`);
      if (group?.is_muted && !isMentioned) return;
      
      new Notification(isMentioned ? `[有人@你] ${group?.name}` : (group?.name || "新消息"), {
          body: `${msg.sender_name}: ${msg.content}`,
          icon: '/icons/logo.ico'
      });
  }

  const selectChat = (item) => {
    setActiveChat({ ...item, type: 'group' });
    setContacts(contacts.map(c => String(c.id) === String(item.id) ? { ...c, unread_count: 0, has_mention: false } : c));
    fetchHistory(item);
    fetchMembers(item.id); 
    // 性能优化：改用 Socket 标记已读
    if (wsManager.socket) wsManager.socket.emit('mark_read', item.id);
    if (wsManager.socket) wsManager.socket.emit('join_group', item.id);
  };

  const sendMessage = React.useCallback(async (content, type = 'text', fileUrl = null) => {
    if (!activeChat || !wsManager.socket) return;
    const payload = { targetId: activeChat.id, targetType: 'group', content, type, fileUrl };
    wsManager.socket.emit('send_message', payload);
    
    setContacts(prev => {
        const index = prev.findIndex(g => String(g.id) === String(activeChat.id));
        if (index === -1) return prev;
        const updated = [...prev];
        const group = { ...updated[index] };
        group.last_message = type === 'text' ? content : (type === 'image' ? '[图片]' : '[文件]');
        group.last_message_time = new Date().toISOString();
        updated.splice(index, 1);
        return [group, ...updated];
    });
  }, [activeChat]);

  const handleFileUpload = React.useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenManager.getToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const fullUrl = `${getWsBaseUrl()}${data.url}`;
        sendMessage(data.filename, file.type.startsWith('image/') ? 'image' : 'file', fullUrl);
      }
    } catch (err) { message.error('上传失败'); }
    return false;
  }, [sendMessage]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="flex h-[93vh] bg-[#f5f5f5] overflow-hidden font-sans border-b border-gray-200">
      {/* 1. Sidebar */}
      <div className="w-64 bg-[#e7e7e7] flex flex-col border-r border-[#d1d1d1]">
        <div className="h-16 flex items-center justify-between px-4 bg-[#f5f5f5] border-b border-[#d1d1d1]">
          <h1 className="text-lg font-bold text-gray-700">消息</h1>
          {isAdmin && (
            <Tooltip title="发起群聊">
                <Button variant="ghost" className="p-2" onClick={() => setIsGroupModalOpen(true)}>
                    <PlusOutlined className="text-lg" />
                </Button>
            </Tooltip>
          )}
        </div>
        <div className="p-3">
           <div className="relative">
             <SearchOutlined className="absolute left-3 top-2.5 text-gray-400" />
             <Input placeholder="搜索" className="pl-9 h-8 bg-[#e2e2e2] border-none text-xs" />
           </div>
        </div>
        <div className="overflow-y-auto h-full space-y-2 p-2">
            {contacts.map(g => (
              <ContactItem 
                key={`g-${g.id}`} 
                g={g} 
                isActive={activeChat?.id === g.id} 
                onClick={selectChat} 
                getFileUrl={getFileUrl} 
              />
            ))}
        </div>
      </div>

      {/* 2. Chat Area */}
      <div className="flex-1 flex flex-col bg-[#f5f5f5]">
        {activeChat ? (
          <>
            <div className="h-16 flex items-center justify-between px-6 bg-[#f5f5f5] border-b border-[#e7e7e7]">
               <div className="flex items-center">
                 <span className="text-lg font-medium text-gray-900">{activeChat.name}</span>
                 {activeChat.is_muted && <AudioMutedOutlined className="ml-2 text-gray-400 text-sm" />}
               </div>
               <Button variant="ghost" onClick={() => setIsMembersDrawerOpen(true)}><MoreOutlined className="text-xl" /></Button>
            </div>
            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <ChatMessage 
                  key={msg.id || `msg-${idx}`} 
                  msg={msg} 
                  currentUser={currentUser} 
                  getFileUrl={getFileUrl} 
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <ChatInput 
              onSend={sendMessage} 
              currentGroupMembers={currentGroupMembers} 
              currentUser={currentUser}
              handleFileUpload={handleFileUpload}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><TeamOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.2 }} /><p>选择一个联系人开始聊天</p></div>
        )}
      </div>

      {/* Members Drawer */}
      <Drawer title={`群成员 (${currentGroupMembers.length})`} placement="right" onClose={() => setIsMembersDrawerOpen(false)} open={isMembersDrawerOpen} width={300}>
        <div className="mb-6 pb-6 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">消息免打扰</span>
            <button onClick={() => toggleMute(activeChat?.id, activeChat?.is_muted)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activeChat?.is_muted ? 'bg-green-500' : 'bg-gray-200'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activeChat?.is_muted ? 'translate-x-6' : 'translate-x-1'}`} /></button>
        </div>
        <List itemLayout="horizontal" dataSource={currentGroupMembers} renderItem={item => (<List.Item><List.Item.Meta avatar={<Avatar src={getFileUrl(item.avatar)} icon={<UserOutlined />} />} title={item.name} description={<div className="text-xs">{item.role === 'admin' && <span className="text-orange-500 mr-2">[群主]</span>}{item.department_name}</div>} /></List.Item>)} />
      </Drawer>
    </div>
  );
};

export default WeChatPage;
