import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, UserCircleIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI';

const SessionDetailModal = ({ isOpen, onClose, session, initialMessages = [] }) => {
  if (!isOpen) return null;

  // --- State ---
  const [messages, setMessages] = useState(initialMessages);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [leftWidth, setLeftWidth] = useState(60); // Percentage
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 }); // Center initially handled by CSS, this is for offset
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]); // { messageId, text, color }
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6'); // Default blue
  const [isSaving, setIsSaving] = useState(false);

  // --- Refs ---
  const modalRef = useRef(null);
  const splitRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // --- Effects ---
  useEffect(() => {
    if (session) {
      // Initialize state from session data if needed
      setRating(session.score ? Math.round(session.score / 20) : 0); // Convert 100 scale to 5 stars
      // Fetch tags or other details if not passed
    }
  }, [session]);

  // --- Handlers: Split Pane Resize ---
  const handleSplitMouseDown = (e) => {
    setIsDraggingSplit(true);
    document.addEventListener('mousemove', handleSplitMouseMove);
    document.addEventListener('mouseup', handleSplitMouseUp);
  };

  const handleSplitMouseMove = (e) => {
    if (!modalRef.current) return;
    const modalRect = modalRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - modalRect.left) / modalRect.width) * 100;
    if (newLeftWidth > 20 && newLeftWidth < 80) { // Min/Max constraints
      setLeftWidth(newLeftWidth);
    }
  };

  const handleSplitMouseUp = () => {
    setIsDraggingSplit(false);
    document.removeEventListener('mousemove', handleSplitMouseMove);
    document.removeEventListener('mouseup', handleSplitMouseUp);
  };

  // --- Handlers: Modal Drag ---
  const handleModalMouseDown = (e) => {
    // Only drag if clicking the header
    if (e.target.closest('.modal-header-drag-area')) {
      setIsDraggingModal(true);
      dragStartPos.current = { x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y };
      document.addEventListener('mousemove', handleModalMouseMove);
      document.addEventListener('mouseup', handleModalMouseUp);
    }
  };

  const handleModalMouseMove = (e) => {
    setModalPosition({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y
    });
  };

  const handleModalMouseUp = () => {
    setIsDraggingModal(false);
    document.removeEventListener('mousemove', handleModalMouseMove);
    document.removeEventListener('mouseup', handleModalMouseUp);
  };

  // --- Handlers: Logic ---
  const handleMessageClick = (msgId) => {
    setSelectedMessageId(msgId);
  };

  const handleAddTag = () => {
    if (!selectedMessageId || !newTagText.trim()) return;
    const newTag = {
      id: Date.now(), // Temp ID
      messageId: selectedMessageId,
      text: newTagText,
      color: newTagColor
    };
    setTags([...tags, newTag]);
    setNewTagText('');
  };

  const handleSave = async () => {
    if (!window.confirm('确定要保存所有修改吗？')) return;
    setIsSaving(true);
    try {
        // Mock save API call
        // await qualityAPI.updateSession(session.id, { ... });
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('保存成功');
        onClose();
    } catch (error) {
        toast.error('保存失败');
    } finally {
        setIsSaving(false);
    }
  };

  // --- Render Helpers ---
  const renderStars = () => {
    return [1, 2, 3, 4, 5].map(star => (
      <StarIcon
        key={star}
        className={`w-6 h-6 cursor-pointer ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
        onClick={() => setRating(star)}
      />
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          width: '80vw',
          height: '90vh',
          transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
          transition: isDraggingModal ? 'none' : 'transform 0.1s'
        }}
      >
        {/* Header */}
        <div
          className="modal-header-drag-area h-14 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-6 cursor-move select-none"
          onMouseDown={handleModalMouseDown}
        >
          <div className="flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              会话详情 - {session?.session_code || '未命名会话'}
            </h2>
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
              {session?.platform} / {session?.shop}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Chat History */}
          <div
            className="flex flex-col bg-gray-50"
            style={{ width: `${leftWidth}%` }}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg, index) => {
                 const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'customer_service';
                 const isSelected = selectedMessageId === msg.id;
                 return (
                   <div
                     key={msg.id || index}
                     className={`flex ${isAgent ? 'justify-end' : 'justify-start'} group`}
                     onClick={() => handleMessageClick(msg.id)}
                   >
                     <div className={`flex max-w-[80%] gap-3 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                       {/* Avatar */}
                       <div className="flex-shrink-0">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isAgent ? 'bg-primary-500' : 'bg-orange-400'}`}>
                           {isAgent ? '服' : '客'}
                         </div>
                       </div>

                       {/* Content */}
                       <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                         <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs text-gray-500">{isAgent ? '客服' : '客户'}</span>
                           <span className="text-xs text-gray-400">{new Date(msg.sent_at).toLocaleTimeString()}</span>
                         </div>
                         <div
                           className={`px-4 py-2 rounded-2xl text-sm shadow-sm cursor-pointer transition-all border-2
                             ${isAgent
                               ? 'bg-primary-600 text-white rounded-tr-none'
                               : 'bg-white text-gray-800 rounded-tl-none'}
                             ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-transparent hover:border-gray-200'}
                           `}
                         >
                           {msg.message_content}
                         </div>
                         {/* Tags Display on Message */}
                         <div className="flex flex-wrap gap-1 mt-1">
                           {tags.filter(t => t.messageId === msg.id).map(tag => (
                             <span
                               key={tag.id}
                               className="px-1.5 py-0.5 text-[10px] rounded text-white"
                               style={{ backgroundColor: tag.color }}
                             >
                               {tag.text}
                             </span>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>

          {/* Resizer */}
          <div
            className="w-1 bg-gray-200 hover:bg-primary-400 cursor-col-resize flex items-center justify-center transition-colors z-10"
            onMouseDown={handleSplitMouseDown}
          >
            <div className="w-0.5 h-8 bg-gray-400 rounded-full" />
          </div>

          {/* Right Panel: Inspection Tools */}
          <div
            className="flex flex-col bg-white border-l border-gray-200"
            style={{ width: `${100 - leftWidth}%` }}
          >
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              {/* Rating Section */}
              <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">会话评分</h3>
                <div className="flex items-center gap-2">
                  {renderStars()}
                  <span className="ml-2 text-sm text-gray-500">{rating * 20}分</span>
                </div>
              </div>

              {/* Tag Management */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  消息标注
                  {selectedMessageId ? <span className="text-xs font-normal text-primary-600 ml-2">(已选中消息)</span> : <span className="text-xs font-normal text-gray-400 ml-2">(请先点击左侧消息)</span>}
                </h3>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    placeholder="输入标签名称..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    disabled={!selectedMessageId}
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-10 p-1 rounded-lg border border-gray-300 cursor-pointer"
                    disabled={!selectedMessageId}
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!selectedMessageId || !newTagText.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    添加
                  </button>
                </div>

                {/* All Tags Stats */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">本会话标签统计：</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(tags.map(t => t.text))).map(tagName => {
                      const count = tags.filter(t => t.text === tagName).length;
                      const color = tags.find(t => t.text === tagName)?.color;
                      return (
                        <span
                          key={tagName}
                          className="px-2 py-1 rounded-md text-xs text-white flex items-center gap-1"
                          style={{ backgroundColor: color }}
                        >
                          {tagName}
                          <span className="bg-white/20 px-1 rounded-full text-[10px]">{count}</span>
                        </span>
                      );
                    })}
                    {tags.length === 0 && <span className="text-xs text-gray-400">暂无标签</span>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 mt-auto">
                <button className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
                  <span>✏️</span> 修改会话内容
                </button>
                <button className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
                  <span>📚</span> 添加到案例库
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 shadow-sm disabled:opacity-70 flex items-center gap-2"
              >
                {isSaving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailModal;
