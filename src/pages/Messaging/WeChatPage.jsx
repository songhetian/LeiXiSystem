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
import { message, Modal, Upload, Avatar, Badge, Tooltip, Image, Drawer, List, Dropdown, Mentions } from 'antd';
import { tokenManager, apiGet, apiPost } from '../../utils/apiClient';
import { io } from 'socket.io-client';
import { getWsBaseUrl, getApiUrl } from '../../utils/apiConfig';

const { Option } = Mentions;

// Simple Shadcn-like Button Component
const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "bg-[#07c160] text-white hover:bg-[#06ad56] focus:ring-green-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
    destructive: "bg-red-500 text-white hover:bg-red-600"
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Input Component
const Input = ({ className = '', ...props }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const WeChatPage = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [contacts, setContacts] = useState([]); // Groups
  const [activeChat, setActiveChat] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Group Details
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);
  const [currentGroupMembers, setCurrentGroupMembers] = useState([]);

  // Create Group Modal (Admin only)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const activeChatRef = useRef(null);

  const isAdmin = useMemo(() => {
    return currentUser?.role === '超级管理员' || currentUser?.role === 'admin';
  }, [currentUser]);

  // --- Initialization ---
  useEffect(() => {
    const token = tokenManager.getToken();
    if (!token) return;
    
    const user = tokenManager.parseToken(token);
    setCurrentUser(user);

    fetchContacts();

    const socketUrl = getWsBaseUrl();
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', () => console.log('Chat Connected'));
    
    // 监听成员更新 (实时刷新)
    newSocket.on('member_update', (data) => {
        const currentChat = activeChatRef.current;
        if (currentChat && data.groupId === currentChat.id) {
            console.log('👥 群成员发生变动，正在刷新...', data);
            fetchMembers(data.groupId);
        }
    });

    newSocket.on('receive_message', (msg) => {
        const currentChat = activeChatRef.current;
        const myName = currentUser?.real_name || currentUser?.name;
        const isMentioned = msg.content && myName && msg.content.includes(`@${myName}`);

        if (currentChat && msg.group_id === currentChat.id) {
             setMessages(prev => [...prev, msg]);
             apiPost('/api/chat/read', { groupId: currentChat.id, messageId: msg.id });
             setTimeout(scrollToBottom, 50);
        } else {
            setContacts(prev => prev.map(g => {
                if (g.id === msg.group_id) {
                    return {
                        ...g,
                        unread_count: (g.unread_count || 0) + 1,
                        has_mention: g.has_mention || isMentioned, // Track mention
                        last_message: msg.content,
                        last_message_time: msg.created_at
                    };
                }
                return g;
            }));
            
            if (document.hidden || !currentChat || currentChat.id !== msg.group_id) {
                showNotification(msg); 
            }
        }
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Removed general auto-scroll effect to avoid conflict with load-more position logic

  useEffect(() => {
      if ("Notification" in window && Notification.permission !== "granted") {
          Notification.requestPermission();
      }
  }, []);

  // --- Logic ---

  const fetchContacts = async () => {
    try {
      const res = await apiGet('/api/chat/contacts');
      if (res.success) {
        setContacts(res.data);
      }
    } catch (err) {
      console.error(err);
      message.error('加载群组失败');
    }
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
                const lastMsgId = newMsgs[newMsgs.length - 1].id;
                apiPost('/api/chat/read', { groupId: chat.id, messageId: lastMsgId });
            }
            setTimeout(scrollToBottom, 100);
        } else {
            // Loading older messages
            const container = scrollContainerRef.current;
            const oldScrollHeight = container.scrollHeight;
            
            setMessages(prev => [...newMsgs, ...prev]);
            setHasMore(newMsgs.length === limit);
            setIsLoadingMore(false);

            // After state update and render, restore scroll position
            setTimeout(() => {
                if (container) {
                    container.scrollTop = container.scrollHeight - oldScrollHeight;
                }
            }, 0);
        }
      }
    } catch (err) {
      console.error(err);
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
      const { scrollTop } = e.currentTarget;
      if (scrollTop === 0 && hasMore && !isLoadingMore && activeChat) {
          const firstMsgId = messages.length > 0 ? messages[0].id : null;
          if (firstMsgId) {
              fetchHistory(activeChat, firstMsgId);
          }
      }
  };

  const fetchMembers = async (groupId) => {
    try {
      const res = await apiGet(`/api/chat/groups/${groupId}/members`);
      if (res.success) {
        setCurrentGroupMembers(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMute = async (groupId, currentMute) => {
      try {
          const res = await apiPost('/api/chat/mute', { groupId, isMuted: !currentMute });
          if (res.success) {
              setContacts(prev => prev.map(c => c.id === groupId ? { ...c, is_muted: !currentMute } : c));
              if (activeChat?.id === groupId) {
                  setActiveChat(prev => ({ ...prev, is_muted: !currentMute }));
              }
              message.success(!currentMute ? '已开启免打扰' : '已关闭免打扰');
          }
      } catch (err) {
          message.error('操作失败');
      }
  };

  const openCreateGroupModal = async () => {
      setIsGroupModalOpen(true);
      try {
          const res = await apiGet('/api/chat/users');
          if (res.success) setAllUsers(res.data);
      } catch (err) { console.error(err); }
  };

  const showNotification = (msg) => {
      if (!("Notification" in window)) return;
      const group = contacts.find(c => c.id === msg.group_id);
      
      // Check if I am mentioned in the text
      const myName = currentUser?.real_name || currentUser?.name;
      const isMentioned = msg.content && myName && msg.content.includes(`@${myName}`);

      // If muted AND not mentioned, don't show
      if (group?.is_muted && !isMentioned) return;

      if (Notification.permission === "granted") {
          const title = isMentioned 
            ? `[有人@你] ${msg.group_name || group?.name || "群聊"}` 
            : (msg.group_name || group?.name || "新消息");

          new Notification(title, {
              body: `${msg.sender_name}: ${msg.content}`,
              icon: '/icons/logo.ico'
          });
      }
  }

  const selectChat = (item) => {
    setActiveChat({ ...item, type: 'group' });
    // Clear unread and mentions
    setContacts(prev => prev.map(c => 
        c.id === item.id ? { ...c, unread_count: 0, has_mention: false } : c
    ));
    fetchHistory(item);
    fetchMembers(item.id); 
    if (socket) {
      socket.emit('join_group', item.id);
    }
  };

  const sendMessage = async (content = inputText, type = 'text', fileUrl = null) => {
    if ((!content || !content.trim() && !fileUrl) || !activeChat || !socket) return;
    const payload = { targetId: activeChat.id, targetType: 'group', content, type, fileUrl };
    socket.emit('send_message', payload);
    setInputText('');
  };

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const uploadUrl = getApiUrl('/api/upload');
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenManager.getToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        // 这里的 data.url 应该是相对路径，如 /uploads/xxx
        // 我们需要转换为绝对路径
        const wsBase = getWsBaseUrl();
        const fullUrl = `${wsBase}${data.url}`;
        sendMessage(data.filename, file.type.startsWith('image/') ? 'image' : 'file', fullUrl);
      }
    } catch (err) {
      message.error('上传失败');
    }
    return false;
  };

  const createGroup = async () => {
    if (!groupName || selectedMembers.length === 0) return;
    try {
      const res = await apiPost('/api/chat/groups', { name: groupName, memberIds: selectedMembers });
      if (res.success) {
        message.success('群组创建成功');
        setIsGroupModalOpen(false);
        fetchContacts();
        setGroupName('');
        setSelectedMembers([]);
      }
    } catch (err) { message.error('Failed to create group'); }
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // --- Render Helpers ---

  const renderContactList = () => {
    return (
      <div className="overflow-y-auto h-full space-y-2 p-2">
        {contacts.length > 0 ? (
          <div className="mb-4">
            {contacts.map(g => (
              <div 
                key={`group-${g.id}`} 
                onClick={() => selectChat(g)}
                className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${activeChat?.id === g.id ? 'bg-[#c6c6c6] shadow-sm' : 'hover:bg-green-50'}`}
              >
                <Badge count={g.is_muted ? 0 : (g.unread_count || 0)} dot={g.is_muted && g.unread_count > 0} size="small" offset={[-5, 5]}>
                   <Avatar shape="square" icon={<TeamOutlined />} className="bg-green-600" src={g.avatar} />
                </Badge>
                <div className="ml-3 font-medium text-gray-800 flex-1 truncate">
                    <div className="flex justify-between items-center">
                        <span className="truncate">{g.name}</span>
                        <div className="flex items-center gap-1">
                            {g.is_muted && <AudioMutedOutlined className="text-[10px] text-gray-400" />}
                            {g.last_message_time && <span className="text-[10px] text-gray-400">{new Date(g.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500 truncate flex-1">
                            {g.has_mention && <span className="text-red-500 font-bold mr-1">[有人@我]</span>}
                            {g.last_message || '暂无消息'}
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="p-4 text-center text-gray-400 text-sm">暂无群组</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[93vh] bg-[#f5f5f5] overflow-hidden font-sans border-b border-gray-200">
      
      {/* 1. Sidebar (Contacts) */}
      <div className="w-64 bg-[#e7e7e7] flex flex-col border-r border-[#d1d1d1]">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 bg-[#f5f5f5] border-b border-[#d1d1d1]">
          <h1 className="text-lg font-bold text-gray-700">消息</h1>
          {isAdmin && (
            <Tooltip title="发起群聊">
                <Button variant="ghost" className="p-2" onClick={openCreateGroupModal}>
                <PlusOutlined className="text-lg" />
                </Button>
            </Tooltip>
          )}
        </div>
        
        {/* Search */}
        <div className="p-3">
           <div className="relative">
             <SearchOutlined className="absolute left-3 top-2.5 text-gray-400" />
             <Input placeholder="搜索" className="pl-9 h-8 bg-[#e2e2e2] border-none text-xs" />
           </div>
        </div>

        {/* List */}
        {renderContactList()}
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#f5f5f5]">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 bg-[#f5f5f5] border-b border-[#e7e7e7]">
               <div className="flex items-center">
                 <span className="text-lg font-medium text-gray-900">{activeChat.name}</span>
                 {activeChat.is_muted && <AudioMutedOutlined className="ml-2 text-gray-400 text-sm" />}
               </div>
               <Button variant="ghost" onClick={() => { setIsMembersDrawerOpen(true); fetchMembers(activeChat.id); }}>
                   <MoreOutlined className="text-xl" />
               </Button>
            </div>

            {/* Messages */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {isLoadingMore && (
                  <div className="flex justify-center py-2">
                      <div className="text-xs text-gray-400 flex items-center">
                          <span className="animate-spin mr-2">⏳</span> 加载中...
                      </div>
                  </div>
              )}
              {!hasMore && messages.length > 0 && (
                  <div className="text-center text-[10px] text-gray-300 py-2">没有更多消息了</div>
              )}
              {messages.map((msg, idx) => {
                // Handle System Messages
                if (msg.msg_type === 'system' || msg.sender_id === 0) {
                    return (
                        <div key={idx} className="flex justify-center my-2">
                            <span className="bg-gray-200/50 text-gray-500 text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider italic">
                                {msg.content}
                            </span>
                        </div>
                    );
                }

                const isMe = msg.sender_id === currentUser?.id;
                const myName = currentUser?.real_name || currentUser?.name;
                const amIMentioned = msg.content && myName && msg.content.includes(`@${myName}`);

                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <Avatar src={msg.sender_avatar} className="mr-2 mt-1 flex-shrink-0" size="small" icon={<UserOutlined />} />
                    )}
                    <div className="max-w-[70%]">
                      {!isMe && <div className="text-xs text-gray-400 mb-1 ml-1">{msg.sender_name}</div>}
                      <div className={`px-4 py-2 rounded-lg text-sm relative break-words shadow-sm 
                        ${isMe ? 'bg-[#95ec69] text-black' : (amIMentioned ? 'bg-amber-100 border border-amber-200 text-amber-900 ring-2 ring-amber-400 ring-opacity-20' : 'bg-white text-gray-800')} 
                        ${msg.msg_type === 'image' ? 'p-1 bg-opacity-50' : ''}`}>
                        {msg.msg_type === 'image' ? (
                            <div className="overflow-hidden rounded-md">
                                <Image src={msg.file_url} alt="image" className="cursor-pointer hover:opacity-90 transition-opacity" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'cover' }} preview={{ mask: <div className="text-white text-xs font-sans">点击预览</div> }} placeholder={<div className="w-40 h-40 bg-gray-100 flex items-center justify-center text-gray-400">加载中...</div>} />
                            </div>
                        ) : msg.msg_type === 'file' ? (
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center underline">
                                <FileOutlined className="mr-2"/> {msg.content}
                            </a>
                        ) : (
                            msg.content
                        )}
                      </div>
                    </div>
                    {isMe && (
                      <Avatar src={currentUser?.avatar} className="ml-2 mt-1 flex-shrink-0 bg-green-600" size="small" icon={<UserOutlined />} />
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#f5f5f5] border-t border-[#e7e7e7] p-4">
              <div className="flex items-center gap-5 mb-3 px-2 text-gray-500">
                <Tooltip title="发送图片">
                    <Upload beforeUpload={handleFileUpload} showUploadList={false} accept="image/*">
                        <PictureOutlined className="text-xl hover:text-[#07c160] cursor-pointer transition-colors" />
                    </Upload>
                </Tooltip>
                <Tooltip title="发送文件">
                    <Upload beforeUpload={handleFileUpload} showUploadList={false}>
                        <FileOutlined className="text-xl hover:text-[#07c160] cursor-pointer transition-colors" />
                    </Upload>
                </Tooltip>
              </div>
              
              <Mentions
                autoSize={{ minRows: 2, maxRows: 6 }}
                className="w-full bg-transparent border-none focus:ring-0 text-sm p-2 shadow-none resize-none"
                placeholder="发送消息..."
                value={inputText}
                onChange={setInputText}
                onKeyDown={e => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                        e.preventDefault(); 
                        sendMessage(); 
                    } 
                }}
                options={currentGroupMembers.filter(m => m.id !== currentUser?.id).map(m => ({
                    value: m.name,
                    label: m.name,
                    key: m.id
                }))}
              />

              <div className="flex justify-between items-center mt-2">
                 <div className="text-xs text-gray-400">Enter 发送, @ 提醒成员</div>
                 <Button onClick={() => sendMessage()}>发送</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <TeamOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.2 }} />
             <p>选择一个联系人开始聊天</p>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <Drawer
        title={`群成员 (${currentGroupMembers.length})`}
        placement="right"
        onClose={() => setIsMembersDrawerOpen(false)}
        open={isMembersDrawerOpen}
        width={300}
      >
        <div className="mb-6 pb-6 border-b">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">消息免打扰</span>
                <button 
                    onClick={() => toggleMute(activeChat?.id, activeChat?.is_muted)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${activeChat?.is_muted ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activeChat?.is_muted ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        <List
          itemLayout="horizontal"
          dataSource={currentGroupMembers}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar src={item.avatar} icon={<UserOutlined />} />}
                title={item.name}
                description={<div className="text-xs">{item.role === 'admin' && <span className="text-orange-500 mr-2">[群主]</span>}{item.department_name}</div>}
              />
            </List.Item>
          )}
        />
      </Drawer>

      <Modal
        title="发起群聊"
        open={isGroupModalOpen}
        onCancel={() => setIsGroupModalOpen(false)}
        onOk={createGroup}
        okText="创建"
        cancelText="取消"
      >
        <div className="space-y-4 py-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">群名称</label>
             <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="请输入群名称" />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">选择成员</label>
             <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                {allUsers.map(u => (
                    <div key={u.id} onClick={() => { if (selectedMembers.includes(u.id)) { setSelectedMembers(prev => prev.filter(id => id !== u.id)); } else { setSelectedMembers(prev => [...prev, u.id]); } }} className={`flex items-center p-2 rounded cursor-pointer ${selectedMembers.includes(u.id) ? 'bg-green-50' : 'hover:bg-gray-50'}`} >
                    <div className={`w-4 h-4 rounded border mr-2 flex items-center justify-center ${selectedMembers.includes(u.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}> {selectedMembers.includes(u.id) && <div className="w-2 h-2 bg-white rounded-full" />} </div>
                    <Avatar size="small" src={u.avatar} className="mr-2" />
                    <span className="text-sm">{u.name}</span>
                    </div>
                ))}
             </div>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default WeChatPage;
