import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './UnreadMemoPopup.css'
import { apiGet, apiPut } from '../utils/apiClient'

const UnreadMemoPopup = ({ onClose }) => {
  const [unreadMemos, setUnreadMemos] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUnreadMemos()
  }, [])

  const loadUnreadMemos = async () => {
    try {
      const response = await apiGet('/api/memos/unread-list')
      // apiClient returns res.json() directly, and it already handled checking for response.ok
      if (response.success && response.data.length > 0) {
        setUnreadMemos(response.data)
      } else {
        onClose()
      }
    } catch (error) {
      logger.error('加载未读备忘录失败:', error)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async () => {
    if (unreadMemos.length === 0) return
    const currentMemo = unreadMemos[currentIndex]

    try {
      await apiPut(`/api/memos/${currentMemo.id}/read`)
      const newMemos = unreadMemos.filter((_, index) => index !== currentIndex)
      setUnreadMemos(newMemos)
      if (newMemos.length === 0) onClose()
      else if (currentIndex >= newMemos.length) setCurrentIndex(newMemos.length - 1)
    } catch (error) {
      logger.error('标记已读失败:', error)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < unreadMemos.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleViewDetail = () => {
    // 跳转到我的备忘录页面
    window.location.href = '/#/personal/my-memos'
    onClose()
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#95a5a6',
      normal: '#3498db',
      high: '#f39c12',
      urgent: '#e74c3c'
    }
    return colors[priority] || colors.normal
  }

  const getPriorityText = (priority) => {
    const texts = {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急'
    }
    return texts[priority] || '普通'
  }

  if (loading) {
    return (
      <div className="unread-memo-popup-overlay">
        <div className="unread-memo-popup">
          <div className="loading">加载中...</div>
        </div>
      </div>
    )
  }

  if (unreadMemos.length === 0) {
    return null
  }

  const currentMemo = unreadMemos[currentIndex]

  return (
    <div className="unread-memo-popup-overlay">
      <div className="unread-memo-popup">
        <div className="popup-header">
          <div className="popup-title">
            <i className="fas fa-bell"></i>
            <span>未读备忘录</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="popup-body">
          <div className="memo-meta">
            <span
              className="priority-badge"
              style={{ backgroundColor: getPriorityColor(currentMemo.priority) }}
            >
              {getPriorityText(currentMemo.priority)}
            </span>
            <span className="memo-type">
              <i className={`fas ${currentMemo.type === 'personal' ? 'fa-user' : 'fa-users'}`}></i>
              {currentMemo.type === 'personal' ? '个人备忘录' : '部门备忘录'}
            </span>
            {currentMemo.creator_name && (
              <span>来自：{currentMemo.creator_name}</span>
            )}
          </div>

          <h3 className="memo-title">{currentMemo.title}</h3>

          <div className="memo-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentMemo.content}
            </ReactMarkdown>
          </div>

          <div className="memo-date">
            创建时间：{new Date(currentMemo.created_at).toLocaleString()}
          </div>
        </div>

        <div className="popup-footer">
          <div className="navigation">
            <button
              className="nav-btn"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <i className="fas fa-chevron-left"></i> 上一条
            </button>
            <span className="position-indicator">
              {currentIndex + 1} / {unreadMemos.length}
            </span>
            <button
              className="nav-btn"
              onClick={handleNext}
              disabled={currentIndex === unreadMemos.length - 1}
            >
              下一条 <i className="fas fa-chevron-right"></i>
            </button>
          </div>

          <div className="actions">
            <button className="btn-secondary" onClick={onClose}>
              稍后查看
            </button>
            <button className="btn-primary" onClick={handleMarkRead}>
              <i className="fas fa-check"></i> 标记已读
            </button>
            <button className="btn-primary" onClick={handleViewDetail}>
              <i className="fas fa-eye"></i> 查看详情
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnreadMemoPopup
