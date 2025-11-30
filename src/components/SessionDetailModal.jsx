import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    XMarkIcon,
    ChatBubbleLeftRightIcon,
    PencilSquareIcon,
    BookmarkSquareIcon,
    CheckCircleIcon,
    TagIcon,
    TrashIcon,
    ArrowPathIcon,
    SwatchIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI';
import Modal from './Modal';
import TagSelector from './TagSelector';
import './SessionDetailModal.css';

const SessionDetailModal = ({ isOpen, onClose, session, initialMessages = [] }) => {
    // --- State ---
    const [messages, setMessages] = useState(initialMessages);
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [leftWidth, setLeftWidth] = useState(60); // Percentage
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);
    const [isDraggingModal, setIsDraggingModal] = useState(false);
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const [bgColor, setBgColor] = useState('#f0fdf4'); // Default light green
    const [showColorPicker, setShowColorPicker] = useState(false);

    // Morandi Colors
    const MORANDI_COLORS = [
        { name: '薄荷绿', value: '#f0fdf4' }, // Default
        { name: '莫兰迪蓝', value: '#e3e8f0' }, // Slate-100ish
        { name: '莫兰迪粉', value: '#fce7f3' }, // Pink-100ish
        { name: '莫兰迪黄', value: '#fef3c7' }, // Amber-100ish
        { name: '莫兰迪灰', value: '#f3f4f6' }, // Gray-100
        { name: '莫兰迪紫', value: '#f3e8ff' }, // Purple-100ish
    ];

    // Inspection Data
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState([]); // Message tags: { id, messageId, text, color }
    const [sessionTags, setSessionTags] = useState([]); // Session level tags

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmSave, setShowConfirmSave] = useState(false);
    const [showEditSession, setShowEditSession] = useState(false);
    const [showAddToCase, setShowAddToCase] = useState(false);
    const [editContent, setEditContent] = useState('');

    // --- Refs ---
    const modalRef = useRef(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const splitRef = useRef(null);

    // --- Draft Management ---
    const draftKey = `session_draft_${session?.id}`;

    // --- Effects ---

    // Sync messages with prop when it changes
    useEffect(() => {
        setMessages(initialMessages);

        // Extract tags from messages and set tags state
        const allTags = [];
        initialMessages.forEach(msg => {
            if (msg.tags && Array.isArray(msg.tags)) {
                msg.tags.forEach(tag => {
                    allTags.push({
                        id: tag.id, // This is the tag ID from database
                        tagId: tag.id, // Real tag ID for saving
                        messageId: msg.id,
                        text: tag.name,
                        color: tag.color
                    });
                });
            }
        });
        setTags(allTags);
    }, [initialMessages]);

    // Load session tags when session changes
    useEffect(() => {
        if (session?.id) {
            qualityAPI.getSessionTags(session.id)
                .then(res => {
                    setSessionTags(res.data.data || []);
                })
                .catch(err => {
                    console.error('Error fetching session tags:', err);
                    setSessionTags([]);
                });
        }
    }, [session]);

    // Load draft or init from session
    useEffect(() => {
        if (isOpen && session) {
            // Load draft if exists
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const draft = JSON.parse(savedDraft);
                setRating(draft.rating || 0);
                setTags(draft.tags || []);
                // Silently restore draft without notification
            } else {
                // Initialize from session data
                setRating(session.score ? Math.round(session.score / 20) : 0);
                // Tags are now loaded from initialMessages
            }
            // Initialize edit content (will be set when editing a message)
            setEditContent('');
        }
    }, [isOpen, session, draftKey]);

    // Auto-save draft
    useEffect(() => {
        if (!isOpen || !session) return;
        const draft = { rating, tags, timestamp: Date.now() };
        localStorage.setItem(draftKey, JSON.stringify(draft));
    }, [rating, tags, isOpen, session, draftKey]);

    // --- Handlers ---

    const handleSessionTagsChange = (newTags) => {
        setSessionTags(newTags);
    };

    const handleMessageTagsChange = (newTags) => {
        if (!selectedMessageId) return;

        // Remove existing tags for this message
        const otherTags = tags.filter(t => t.messageId !== selectedMessageId);

        // Add new tags
        const newMessageTags = newTags.map(tag => ({
            id: Date.now() + Math.random(), // Temporary ID for UI
            tagId: tag.id, // Real tag ID
            messageId: selectedMessageId,
            text: tag.name,
            color: tag.color
        }));

        setTags([...otherTags, ...newMessageTags]);
    };

    // Split Pane Handlers
    const handleSplitMouseDown = (e) => {
        setIsDraggingSplit(true);
        document.addEventListener('mousemove', handleSplitMouseMove);
        document.addEventListener('mouseup', handleSplitMouseUp);
    };

    const handleSplitMouseMove = useCallback((e) => {
        if (!modalRef.current) return;
        const modalRect = modalRef.current.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - modalRect.left) / modalRect.width) * 100;
        if (newLeftWidth > 20 && newLeftWidth < 80) {
            setLeftWidth(newLeftWidth);
        }
    }, []);

    const handleSplitMouseUp = useCallback(() => {
        setIsDraggingSplit(false);
        document.removeEventListener('mousemove', handleSplitMouseMove);
        document.removeEventListener('mouseup', handleSplitMouseUp);
    }, [handleSplitMouseMove]);

    // Modal Drag Handlers
    const handleModalMouseDown = (e) => {
        if (e.target.closest('.modal-header-drag-area') && !e.target.closest('button')) {
            setIsDraggingModal(true);
            dragStartPos.current = {
                x: e.clientX - modalPosition.x,
                y: e.clientY - modalPosition.y
            };
            document.addEventListener('mousemove', handleModalMouseMove);
            document.addEventListener('mouseup', handleModalMouseUp);
        }
    };

    const handleModalMouseMove = useCallback((e) => {
        setModalPosition({
            x: e.clientX - dragStartPos.current.x,
            y: e.clientY - dragStartPos.current.y
        });
    }, []);

    const handleModalMouseUp = useCallback(() => {
        setIsDraggingModal(false);
        document.removeEventListener('mousemove', handleModalMouseMove);
        document.removeEventListener('mouseup', handleModalMouseUp);
    }, [handleModalMouseMove]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Calculate total score from 5-star rating (0-100)
            const totalScore = rating * 20;

            // Construct payload compatible with existing API
            const ruleScore = totalScore;

            await qualityAPI.submitReview(session.id, {
                score: totalScore,
                grade: totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 60 ? 'C' : 'D',
                rule_scores: [
                    { rule_id: 1, score: ruleScore, comment: 'Attitude' },
                    { rule_id: 2, score: ruleScore, comment: 'Professional' },
                    { rule_id: 3, score: ruleScore, comment: 'Communication' }
                ],
                comment: editContent || '通过新版质检界面评分',
                session_tags: sessionTags,
                message_tags: tags.map(t => ({
                    messageId: t.messageId,
                    tagId: t.tagId || t.id,
                    text: t.text,
                    color: t.color
                }))
            });

            // Clear draft
            localStorage.removeItem(draftKey);

            toast.success('保存成功');
            setShowConfirmSave(false);
            onClose();
        } catch (error) {
            console.error('Save failed:', error);
            toast.error('保存失败: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    // --- Helpers ---

    // Get currently selected tags for the selected message
    const currentMessageTags = selectedMessageId
        ? tags.filter(t => t.messageId === selectedMessageId).map(t => ({
            id: t.tagId || t.id, // Handle both temporary and real IDs
            name: t.text,
            color: t.color
        }))
        : [];

    const renderStars = () => {
        return [1, 2, 3, 4, 5].map(star => (
            <StarIcon
                key={star}
                className={`w-8 h-8 cursor-pointer transition-colors ${star <= rating ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-200'}`}
                onClick={() => setRating(star)}
            />
        ));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up"
                style={{
                    width: '80vw',
                    height: '90vh',
                    transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
                    transition: isDraggingModal ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                {/* Header */}
                <div
                    className="modal-header-drag-area h-16 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between px-6 cursor-move select-none"
                    onMouseDown={handleModalMouseDown}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">
                                会话详情
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">{session?.session_code}</span>
                                <span>•</span>
                                <span>{session?.platform}</span>
                                <span>•</span>
                                <span>{session?.shop}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Color Picker - Always Visible */}
                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-500 mr-1">背景:</span>
                            {MORANDI_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${bgColor === color.value ? 'border-blue-500 shadow-md' : 'border-gray-300'}`}
                                    style={{ backgroundColor: color.value }}
                                    onClick={() => setBgColor(color.value)}
                                    title={color.name}
                                />
                            ))}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* Left Panel: Chat History */}
                    <div
                        className="flex flex-col transition-colors duration-300"
                        style={{ width: `${leftWidth}%`, backgroundColor: bgColor }}
                    >
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {messages.map((msg, index) => {
                                const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'customer_service';
                                const isSelected = selectedMessageId === msg.id;
                                const msgTags = tags.filter(t => t.messageId === msg.id);

                                return (
                                    <div
                                        key={msg.id || index}
                                        className={`flex ${isAgent ? 'justify-end' : 'justify-start'} group`}
                                        onClick={() => setSelectedMessageId(msg.id)}
                                    >
                                        <div className={`flex max-w-[92%] gap-3 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {/* Avatar */}
                                            <div className={`avatar flex-shrink-0 ${isAgent ? 'agent' : 'customer'}`}>
                                                {isAgent ? '服' : '客'}
                                            </div>

                                            {/* Content */}
                                            <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} message-container`}>
                                                <div className="chat-info-area">
                                                    <span className="chat-info-text">{isAgent ? '客服' : '客户'}</span>
                                                    <span className="chat-info-text text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                                </div>

                                                <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${isSelected ? 'selected' : 'cursor-pointer'}`}>
                                                    {msg.content}
                                                </div>

                                                {/* Tags on Message */}
                                                {msgTags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2 px-1 justify-end">
                                                        {msgTags.map(tag => (
                                                            <span
                                                                key={tag.id}
                                                                className="tag-chip"
                                                                style={{ backgroundColor: tag.color }}
                                                            >
                                                                {tag.text}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resizer */}
                    <div
                        className={`resizer ${isDraggingSplit ? 'dragging' : ''}`}
                        onMouseDown={handleSplitMouseDown}
                    >
                        <div className="resizer-handle" />
                    </div>

                    {/* Right Panel: Inspection Tools */}
                    <div
                        className="flex flex-col bg-white border-l border-gray-200"
                        style={{ width: `${100 - leftWidth}%` }}
                    >
                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            {/* Rating Section */}
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <StarIcon className="w-4 h-4 text-yellow-500" />
                                    会话评分
                                </h3>
                                <div className="py-2 flex flex-col items-center justify-center gap-3">
                                    <div className="flex gap-2">
                                        {renderStars()}
                                    </div>
                                    <span className={`text-sm font-medium ${rating > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                                        {rating > 0 ? `${rating * 20} 分` : '未评分'}
                                    </span>
                                </div>
                            </div>

                            {/* Quality Review Comment Section */}
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <PencilSquareIcon className="w-4 h-4 text-purple-500" />
                                    质检评语
                                </h3>
                                <div className="py-2">
                                    <textarea
                                        className="w-full h-32 p-3 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm transition-all"
                                        placeholder="请输入质检评语..."
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                    />
                                    <div className="mt-2 text-xs text-gray-400 text-right">
                                        {editContent.length} / 500
                                    </div>
                                </div>
                            </div>

                            {/* Tag Management */}
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <TagIcon className="w-4 h-4 text-blue-500" />
                                    会话标签
                                </h3>
                                <div className="py-2">
                                    <TagSelector
                                        selectedTags={sessionTags}
                                        onTagsChange={handleSessionTagsChange}
                                        placeholder="添加会话标签..."
                                    />
                                </div>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-green-500" />
                                    消息标注
                                </h3>

                                {selectedMessageId ? (
                                    <div className="py-2 space-y-3">
                                        <div className="text-xs text-blue-600 font-medium px-1">
                                            已选中消息 ID: {selectedMessageId}
                                        </div>
                                        <TagSelector
                                            selectedTags={currentMessageTags}
                                            onTagsChange={handleMessageTagsChange}
                                            placeholder="为消息添加标签..."
                                        />
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border-dashed border border-gray-200">
                                        点击左侧消息进行标注
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        if (selectedMessageId) {
                                            const selectedMsg = messages.find(m => m.id === selectedMessageId);
                                            if (selectedMsg) {
                                                setEditContent(selectedMsg.content);
                                                setShowEditSession(true);
                                            }
                                        } else {
                                            toast.warning('请先选择要编辑的消息');
                                        }
                                    }}
                                    disabled={!selectedMessageId}
                                    className={`flex items-center justify-center gap-2 py-2.5 px-4 border rounded-xl text-sm font-medium transition-all shadow-sm ${selectedMessageId
                                        ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                        : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <PencilSquareIcon className="w-4 h-4" />
                                    修改消息
                                </button>
                                <button
                                    onClick={() => setShowAddToCase(true)}
                                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                >
                                    <BookmarkSquareIcon className="w-4 h-4" />
                                    加入案例
                                </button>
                            </div>
                            <button
                                onClick={() => setShowConfirmSave(true)}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                保存所有修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Sub Modals --- */}

            {/* Confirm Save Modal */}
            <Modal
                isOpen={showConfirmSave}
                onClose={() => setShowConfirmSave(false)}
                title="确认保存"
                size="small"
                zIndex={1100}
                variant="primary"
            >
                <div className="py-4">
                    <p className="text-gray-600 mb-4">确定要保存对该会话的所有修改吗？</p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowConfirmSave(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            {isSaving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                            确认保存
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Message Modal */}
            <Modal
                isOpen={showEditSession}
                onClose={() => setShowEditSession(false)}
                title="修改消息内容"
                zIndex={1100}
                variant="warning"
            >
                <div className="py-4 space-y-4">
                    <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-yellow-800">
                        注意：此操作将永久修改数据库中的消息内容。
                    </div>
                    <textarea
                        className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                        placeholder="在此编辑消息内容..."
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowEditSession(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            取消
                        </button>
                        <button
                            onClick={async () => {
                                if (selectedMessageId && editContent.trim()) {
                                    try {
                                        // Call API to update message content
                                        await qualityAPI.updateMessage(selectedMessageId, { content: editContent });

                                        // Update local state
                                        setMessages(prevMessages =>
                                            prevMessages.map(msg =>
                                                msg.id === selectedMessageId
                                                    ? { ...msg, content: editContent }
                                                    : msg
                                            )
                                        );
                                        toast.success('消息内容已更新');
                                        setShowEditSession(false);
                                    } catch (error) {
                                        console.error('Update failed:', error);
                                        toast.error('更新失败: ' + (error.response?.data?.message || error.message));
                                    }
                                } else {
                                    toast.error('消息内容不能为空');
                                }
                            }}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                        >
                            保存修改
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Add to Case Modal */}
            <Modal
                isOpen={showAddToCase}
                onClose={() => setShowAddToCase(false)}
                title="添加到案例库"
                zIndex={1100}
                variant="success"
            >
                <div className="py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">案例标题</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="请输入案例标题" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">选择分类</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500">
                            <option>优秀话术</option>
                            <option>反面教材</option>
                            <option>投诉处理</option>
                            <option>业务咨询</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">备注说明</label>
                        <textarea className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="请输入备注说明..." />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setShowAddToCase(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            取消
                        </button>
                        <button
                            onClick={() => {
                                toast.success('已添加到案例库');
                                setShowAddToCase(false);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            确认添加
                        </button>
                    </div>
                </div>
            </Modal >
        </div >
    );
};

export default SessionDetailModal;
