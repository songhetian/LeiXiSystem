import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  SmileOutlined,
  PlusOutlined,
  AudioOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  FileOutlined,
  CameraOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import './WeChatPage.css';

const WeChatPage = () => {
  const [inputText, setInputText] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchContact, setSearchContact] = useState('');
  const [contacts, setContacts] = useState([
    {
      id: 1,
      name: '测试联系人1',
      avatar: '测1',
      lastMessage: '这是最后一条消息',
      time: '10:30',
      unread: 0,
    },
    {
      id: 2,
      name: '测试联系人2',
      avatar: '测2',
      lastMessage: '你好',
      time: '09:15',
      unread: 2,
    },
    {
      id: 3,
      name: '测试群3',
      avatar: '群3',
      lastMessage: '群消息',
      time: '昨天',
      unread: 0,
      isGroup: true,
    },
  ]);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'received',
      content: '你好',
      timestamp: '10:25',
      avatar: '测',
    },
    {
      id: 2,
      type: 'sent',
      content: '你好，有什么可以帮你的吗？',
      timestamp: '10:26',
      avatar: '我',
    },
    {
      id: 3,
      type: 'received',
      content: '没事，随便聊聊',
      timestamp: '10:30',
      avatar: '测',
    },
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // 默认选中第一个联系人
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0]);
    }
  }, [contacts]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage = {
        id: messages.length + 1,
        type: 'sent',
        content: inputText,
        timestamp: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        avatar: 'M',
      };
      setMessages([...messages, newMessage]);
      setInputText('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const shouldShowTimestamp = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentTime = new Date(`2024-01-01 ${currentMsg.timestamp}`);
    const prevTime = new Date(`2024-01-01 ${prevMsg.timestamp}`);
    return (currentTime - prevTime) / 1000 / 60 > 5;
  };

  const filteredContacts = useMemo(() => {
    if (!searchContact.trim()) return contacts;
    return contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchContact.toLowerCase())
    );
  }, [contacts, searchContact]);

  return (
    <div className="wechat-page">
      {/* Left Sidebar - Contact List */}
      <div className="wechat-sidebar">
        {/* Search Box */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="搜索"
            value={searchContact}
            onChange={(e) => setSearchContact(e.target.value)}
            className="search-input"
          />
          <button className="add-contact-btn">
            <PlusOutlined />
          </button>
        </div>

        {/* Contact List */}
        <div className="contact-list">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className={`contact-item ${
                selectedContact?.id === contact.id ? 'active' : ''
              }`}
              onClick={() => setSelectedContact(contact)}
            >
              <div className="contact-avatar">
                {contact.isOfficial ? (
                  <div className="official-avatar">📁</div>
                ) : (
                  <div className="avatar-text">{contact.avatar}</div>
                )}
                {contact.unread > 0 && (
                  <span className="unread-badge">{contact.unread}</span>
                )}
              </div>
              <div className="contact-info">
                <div className="contact-header">
                  <span className="contact-name">{contact.name}</span>
                  <span className="contact-time">{contact.time}</span>
                </div>
                <div className="contact-message">{contact.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="wechat-main">
        <div className="wechat-header">
          <button className="header-btn">
            <ArrowLeftOutlined />
          </button>
          <div className="header-title">
            <h2>{selectedContact?.name || '选择联系人'}</h2>
          </div>
          <button className="header-btn">
            <MoreOutlined />
          </button>
        </div>

      {/* Messages Area */}
      <div className="wechat-messages">
        {messages.map((msg, index) => (
          <div key={msg.id}>
            {shouldShowTimestamp(msg, messages[index - 1]) && (
              <div className="message-timestamp">{msg.timestamp}</div>
            )}
            <div className={`message-wrapper ${msg.type}`}>
              {msg.type === 'received' && (
                <div className="message-avatar">{msg.avatar}</div>
              )}
              <div className={`message-bubble ${msg.type}`}>
                <div className="message-content">{msg.content}</div>
              </div>
              {msg.type === 'sent' && (
                <div className="message-avatar sent">{msg.avatar}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Bar */}
      <div className="wechat-input-bar">
        <div className="input-controls">
          <button className="input-btn">
            <SmileOutlined />
          </button>
          <button className="input-btn">
            <PlusOutlined />
          </button>
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="请输入消息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              className="message-input"
            />
          </div>
          <button className="send-btn" onClick={handleSend}>
            发送
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default WeChatPage;
