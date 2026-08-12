import logger from '@/utils/logger';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  SmileOutlined,
  AudioOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  FileOutlined,
  CameraOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { tokenManager, apiGet, apiPost } from '../../utils/apiClient';
import './WeChatPage.css';

const BroadcastPage = () => {
  // 广播相关状态
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [searchContact, setSearchContact] = useState('');
  const [searchType, setSearchType] = useState(''); // 搜索类型：部门/个人/全体
  const [searchDepartment, setSearchDepartment] = useState(''); // 部门搜索

  // 控制模态框显示
  const [showReadByModal, setShowReadByModal] = useState(false);
  const [currentReadBy, setCurrentReadBy] = useState([]);
  const [modalTitle, setModalTitle] = useState('');

  // 真实数据状态
  const [viewableDepartments, setViewableDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // 构建联系人数据
  const [contacts, setContacts] = useState([]);

  // 已选中的联系人（持久化保存）
  const [savedRecipients, setSavedRecipients] = useState(() => {
    const saved = localStorage.getItem('broadcastRecipients');
    return saved ? JSON.parse(saved) : [];
  });

  // 消息历史（从服务器获取的真实数据）
  const [messages, setMessages] = useState([]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 保存已选联系人到localStorage
  useEffect(() => {
    localStorage.setItem('broadcastRecipients', JSON.stringify(savedRecipients));
  }, [savedRecipients]);

  // 获取真实数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 从JWT中获取用户信息和可见部门
        const token = tokenManager.getToken();
        const payload = tokenManager.parseToken(token);

        // 获取用户可见的部门IDs
        const viewableDeptIds = payload?.viewableDepartmentIds || [];
        logger.debug('用户可见部门IDs:', viewableDeptIds);

        if (viewableDeptIds.length > 0) {
          // 获取部门列表 - 使用与BroadcastManagement.jsx相同的方式
          const deptsResponse = await apiGet('/api/departments');
          if (Array.isArray(deptsResponse)) {
            // 过滤出用户可见的部门
            const filteredDepartments = deptsResponse.filter(dept =>
              viewableDeptIds.includes(dept.id)
            );
            setViewableDepartments(filteredDepartments);
            logger.debug('获取到的部门信息:', filteredDepartments);
          }

          // 获取员工信息 - 使用与BroadcastManagement.jsx相同的方式
          const employeesResponse = await apiGet('/api/employees');
          if (Array.isArray(employeesResponse)) {
            setEmployees(employeesResponse);
            logger.debug('获取到的员工信息:', employeesResponse);
          }
        } else {
          // 如果没有可见部门，获取所有部门（这种情况应该很少见）
          const deptsResponse = await apiGet('/api/departments');
          if (Array.isArray(deptsResponse)) {
            setViewableDepartments(deptsResponse); // 显示所有可见部门
          }
          // 获取所有员工
          const employeesResponse = await apiGet('/api/employees');
          if (Array.isArray(employeesResponse)) {
            setEmployees(employeesResponse);
          }
        }
      } catch (error) {
        logger.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  // 构建联系人数据
  useEffect(() => {
    const contactList = [];

    // 添加部门
    viewableDepartments.forEach(dept => {
      // 获取该部门的员工数量
      const deptEmployees = employees.filter(emp => emp.department_id === dept.id);
      contactList.push({
        id: dept.id,
        name: dept.name,
        type: 'department',
        avatar: dept.name.substring(0, 1),
        members: deptEmployees.length,
        employees: deptEmployees
      });
    });

    // 添加个人
    employees.forEach(emp => {
      const dept = viewableDepartments.find(d => d.id === emp.department_id);
      contactList.push({
        id: emp.id,
        name: emp.real_name,
        type: 'individual',
        avatar: emp.real_name.substring(0, 1),
        department: dept ? dept.name : ''
      });
    });

    // 添加全体成员
    const totalMembers = employees.length;
    if (totalMembers > 0) {
      contactList.push({
        id: 999,
        name: '全体成员',
        type: 'all',
        avatar: '全',
        members: totalMembers,
        departments: viewableDepartments.map(d => d.name)
      });
    }

    setContacts(contactList);
  }, [viewableDepartments, employees]);

  // 根据搜索类型和关键词过滤联系人
  const filteredContacts = useMemo(() => {
    if (!searchType) return [];

    let result = contacts.filter(contact => contact.type === searchType);

    // 如果有搜索关键词，进行过滤
    if (searchContact.trim()) {
      result = result.filter(contact =>
        contact.name.toLowerCase().includes(searchContact.toLowerCase())
      );
    }

    // 如果是个人搜索，并且有部门筛选
    if (searchType === 'individual' && searchDepartment.trim()) {
      result = result.filter(contact =>
        contact.department.toLowerCase().includes(searchDepartment.toLowerCase())
      );
    }

    return result;
  }, [contacts, searchContact, searchType, searchDepartment]);

  // 处理发送广播
  const handleSendBroadcast = async () => {
    if (!broadcastContent.trim() || selectedRecipients.length === 0) {
      alert('请填写广播内容并选择接收人');
      return;
    }

    try {
      // 构造发送数据
      let targetType = '';
      let targetData = null;

      if (selectedRecipients.some(r => r.type === 'all')) {
        targetType = 'all';
      } else if (selectedRecipients.some(r => r.type === 'department')) {
        targetType = 'department';
        targetData = selectedRecipients.filter(r => r.type === 'department').map(r => r.id);
      } else {
        targetType = 'individual';
        targetData = selectedRecipients.filter(r => r.type === 'individual').map(r => r.id);
      }

      const payload = {
        title: broadcastTitle || '广播消息',
        content: broadcastContent,
        type: 'info',
        priority: 'normal',
        targetType: targetType,
        targetDepartments: targetType === 'department' ? JSON.stringify(targetData) : null,
        targetUsers: targetType === 'individual' ? JSON.stringify(targetData) : null
      };

      // 发送广播
      const response = await apiPost('/api/broadcasts', payload);

      if (response.success) {
        // 显示成功消息
        alert(`广播发送成功！已发送给 ${response.data.recipientCount} 人`);

        // 创建本地消息记录
        const newMessage = {
          id: messages.length + 1,
          type: 'sent',
          title: broadcastTitle || '广播消息',
          content: broadcastContent,
          timestamp: new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          recipients: selectedRecipients.map(r => r.name).join(', '),
          readCount: 0,
          totalCount: response.data.recipientCount,
          avatar: broadcastContent.substring(0, 1),
          readBy: [] // 初始为空
        };

        setMessages([...messages, newMessage]);

        // 重置表单
        setBroadcastTitle('');
        setBroadcastContent('');
      } else {
        alert('广播发送失败：' + (response.message || '未知错误'));
      }
    } catch (error) {
      logger.error('发送广播失败:', error);
      alert('广播发送失败：' + error.message);
    }
  };

  // 切换联系人选择
  const toggleRecipient = (contact) => {
    setSelectedRecipients(prev => {
      const isSelected = prev.some(r => r.id === contact.id);
      if (isSelected) {
        return prev.filter(r => r.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  // 添加到已保存联系人
  const addToSavedRecipients = (contact) => {
    setSavedRecipients(prev => {
      const isAlreadySaved = prev.some(r => r.id === contact.id);
      if (!isAlreadySaved) {
        return [...prev, contact];
      }
      return prev;
    });
  };

  // 从已保存联系人中移除
  const removeFromSavedRecipients = (contactId) => {
    setSavedRecipients(prev => prev.filter(r => r.id !== contactId));
  };

  // 显示已读人员名单 - 改为模态框
  const showReadByList = (readBy, title) => {
    setCurrentReadBy(readBy);
    setModalTitle(title);
    setShowReadByModal(true);
  };

  // 关闭模态框
  const closeReadByModal = () => {
    setShowReadByModal(false);
    setCurrentReadBy([]);
    setModalTitle('');
  };

  if (loading) {
    return (
      <div className="wechat-page" style={{ height: '95vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="wechat-page" style={{ height: '95vh' }}>
      {/* Left Sidebar - Contact List and Search */}
      <div className="wechat-sidebar" style={{ width: '300px' }}>
        {/* Search Box */}
        <div className="sidebar-search">
          {/* Type Selection Buttons - 放在独立的一行 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setSearchType('department')}
              style={{
                flex: 1,
                padding: '8px 4px', // 减小高度
                backgroundColor: searchType === 'department' ? '#07c160' : '#f0f0f0',
                color: searchType === 'department' ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px', // 圆角
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // 阴影
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
            >
              部门
            </button>
            <button
              onClick={() => setSearchType('individual')}
              style={{
                flex: 1,
                padding: '8px 4px', // 减小高度
                backgroundColor: searchType === 'individual' ? '#07c160' : '#f0f0f0',
                color: searchType === 'individual' ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px', // 圆角
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // 阴影
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
            >
              个人
            </button>
            <button
              onClick={() => setSearchType('all')}
              style={{
                flex: 1,
                padding: '8px 4px', // 减小高度
                backgroundColor: searchType === 'all' ? '#07c160' : '#f0f0f0',
                color: searchType === 'all' ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px', // 圆角
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // 阴影
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseOut={(e) => e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
            >
              全体
            </button>
          </div>

          {/* 搜索框 - 独立放在第二行 */}
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              placeholder={`搜索${searchType === 'department' ? '部门' : searchType === 'individual' ? '个人' : '全体'}...`}
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              className="search-input"
              style={{ width: '100%', marginBottom: '8px' }}
            />

            {/* 部门搜索框 - 仅在搜索个人时显示 */}
            {searchType === 'individual' && (
              <input
                type="text"
                placeholder="按部门筛选..."
                value={searchDepartment}
                onChange={(e) => setSearchDepartment(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
              />
            )}
          </div>
        </div>

        {/* Saved Recipients */}
        {savedRecipients.length > 0 && (
          <div style={{ padding: '0 12px 12px 12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>常用联系人</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {savedRecipients.map(recipient => (
                <div
                  key={`saved-${recipient.id}`}
                  onClick={() => toggleRecipient(recipient)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: selectedRecipients.some(r => r.id === recipient.id) ? '#07c160' : '#f0f0f0',
                    color: selectedRecipients.some(r => r.id === recipient.id) ? 'white' : '#333',
                    borderRadius: '16px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {recipient.name}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromSavedRecipients(recipient.id);
                    }}
                    style={{
                      cursor: 'pointer',
                      color: selectedRecipients.some(r => r.id === recipient.id) ? 'white' : '#ff4d4f'
                    }}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact List */}
        <div className="contact-list">
          {searchType ? (
            filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`contact-item ${
                    selectedRecipients.some(r => r.id === contact.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleRecipient(contact)}
                  onDoubleClick={() => addToSavedRecipients(contact)}
                >
                  <div className="contact-avatar">
                    <div className="avatar-text">{contact.avatar}</div>
                  </div>
                  <div className="contact-info">
                    <div className="contact-header">
                      <span className="contact-name">{contact.name}</span>
                    </div>
                    <div className="contact-message">
                      {contact.type === 'department'
                        ? `${contact.members}名成员`
                        : contact.type === 'individual'
                          ? contact.department
                          : `${contact.members}名成员`}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 8px',
                    backgroundColor: selectedRecipients.some(r => r.id === contact.id) ? '#07c160' : '#f0f0f0',
                    color: selectedRecipients.some(r => r.id === contact.id) ? 'white' : '#333',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    {selectedRecipients.some(r => r.id === contact.id) ? '已选' : '选择'}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                无匹配的{searchType === 'department' ? '部门' : searchType === 'individual' ? '个人' : '全体'}信息
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              请选择搜索类型
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="wechat-main">
        <div className="wechat-header">
          <div className="header-title">
            <h2>广播消息</h2>
          </div>
        </div>

        {/* 添加一个测试按钮来验证我们的修改是否生效 */}
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>
          <button
            onClick={() => {
              // 创建一个测试消息来验证样式
              const testMsg = {
                id: 'test-' + Date.now(),
                title: '测试消息',
                content: '这是一个测试消息，用来验证样式修改是否生效。',
                timestamp: new Date().toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                recipients: '测试用户',
                readCount: 1,
                totalCount: 5,
                avatar: '测'
              };
              setMessages(prev => [...prev, testMsg]);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            添加测试消息
          </button>
        </div>

        {/* Messages Area - Broadcast History - 改为列表样式 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          backgroundColor: '#f0f2f5',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                padding: '12px 16px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => showReadByList(msg.readBy, msg.title)}
            >
              {/* 图标 */}
              <div style={{
                flexShrink: 0,
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: '#e6f7ff',
                color: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>

              {/* 文本内容 */}
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '12px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 500,
                      backgroundColor: '#e6f7ff',
                      color: '#1890ff',
                      opacity: 0.8
                    }}>
                      系统通知
                    </span>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#333',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {msg.title}
                    </h3>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    color: '#999',
                    flexShrink: 0
                  }}>
                    {msg.timestamp}
                  </span>
                </div>

                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: 0,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {msg.content}
                </p>

                <div style={{
                  fontSize: '11px',
                  color: '#999',
                  marginTop: '2px'
                }}>
                  发送给: {msg.recipients} | 已读: {msg.readCount}/{msg.totalCount}
                </div>
              </div>

              <svg xmlns="http://www.w3.org/2000/svg" style={{
                width: '16px',
                height: '16px',
                color: '#ccc',
                alignSelf: 'center',
                flexShrink: 0
              }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Bar - Like WeChat (去除+按钮) */}
        <div className="wechat-input-bar">
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              {selectedRecipients.map(recipient => (
                <div
                  key={recipient.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: '#e0e0e0',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                >
                  {recipient.name}
                  <span
                    onClick={() => toggleRecipient(recipient)}
                    style={{
                      marginLeft: '4px',
                      cursor: 'pointer',
                      color: '#ff4d4f'
                    }}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
            {selectedRecipients.length > 0 && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                发送给: {selectedRecipients.map(r => r.name).join(', ')}
              </div>
            )}
          </div>

          <div className="input-controls">
            {/* 去除了+按钮 */}
            <div className="input-wrapper">
              <textarea
                placeholder="请输入广播内容..."
                value={broadcastContent}
                onChange={(e) => setBroadcastContent(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl+Enter 或 Cmd+Enter 发送
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSendBroadcast();
                  }
                }}
                className="message-input"
                style={{
                  minHeight: '40px', // 减小最小高度
                  resize: 'none',
                  fontFamily: 'inherit',
                  maxHeight: '100px', // 限制最大高度
                  overflowY: 'auto' // 超出时显示滚动条
                }}
              />
            </div>
            <button
              className="send-btn"
              onClick={handleSendBroadcast}
              disabled={!broadcastContent.trim() || selectedRecipients.length === 0}
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Read By Modal - 优化模态框设计 */}
      {showReadByModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #eee'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{modalTitle} - 已读人员详情</h3>
              <button
                onClick={closeReadByModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  color: '#999',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.3s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                ×
              </button>
            </div>
            <div style={{
              maxHeight: '60vh',
              overflowY: 'auto',
              paddingRight: '8px'
            }}>
              {currentReadBy.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '12px'
                }}>
                  {currentReadBy.map((name, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px 8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#333',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                      onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#07c160',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {name.charAt(0)}
                      </div>
                      {name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                  <p>暂无已读人员</p>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={closeReadByModal}
                style={{
                  padding: '10px 30px',
                  backgroundColor: '#07c160',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  boxShadow: '0 2px 6px rgba(7, 193, 96, 0.3)',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#06b054';
                  e.target.style.boxShadow = '0 4px 12px rgba(7, 193, 96, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#07c160';
                  e.target.style.boxShadow = '0 2px 6px rgba(7, 193, 96, 0.3)';
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastPage;
