import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    X, 
    MessageSquare, 
    Star, 
    Tag as TagIcon, 
    Edit3, 
    Save, 
    RotateCcw, 
    AlertCircle,
    CheckCircle2,
    Bookmark
} from 'lucide-react';
import { toast } from 'sonner';
import qualityAPI from '../api/qualityAPI';
import './SessionDetailModal.css';

// --- 性能优化：Memo化的消息条目组件 ---
const MessageItem = React.memo(({ 
    msg, 
    isSelected, 
    isEditing, 
    msgTags, 
    onSelect, 
    onEditStart, 
    onEditSave, 
    onEditCancel,
    inlineValue,
    setInlineValue,
    readOnly
}) => {
    const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'customer_service';
    
    return (
        <div 
            className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} group relative transition-all mb-6`}
            onClick={() => onSelect(msg.id)}
        >
            <div className={`flex items-end gap-3 max-w-[85%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* 头像 - 扁平化图标模式 */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0 ${isAgent ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                    {isAgent ? '客服' : '客户'}
                </div>
                
                <div className="flex flex-col gap-1 min-w-0">
                    {/* 工具条：修正按钮位置，避开正面重叠 */}
                    {!readOnly && !isEditing && (
                        <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity mb-1`}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEditStart(msg.id, msg.content); }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-md border border-slate-200 text-[9px] font-bold"
                            >
                                <Edit3 size={10} /> 修正内容
                            </button>
                        </div>
                    )}

                    {isEditing ? (
                        <div className="bg-white border-2 border-indigo-500 rounded-xl p-3 w-full min-w-[320px] shadow-2xl animate-in zoom-in-95 duration-200 z-10">
                            <textarea 
                                autoFocus
                                className="w-full text-[13px] text-slate-700 bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[80px] leading-relaxed"
                                value={inlineValue}
                                onChange={e => setInlineValue(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                                <button onClick={onEditCancel} className="text-[10px] font-bold text-slate-400 px-3 py-1">取消</button>
                                <button onClick={() => onEditSave(msg.id)} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-lg shadow-md">确认保存</button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onDoubleClick={() => !readOnly && onEditStart(msg.id, msg.content)}
                            className={`px-5 py-3 rounded-2xl text-[13px] leading-relaxed transition-all cursor-pointer border ${
                                isSelected 
                                    ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-lg border-indigo-100 scale-[1.01]' 
                                    : 'hover:bg-slate-50 border-transparent shadow-sm'
                            } ${isAgent ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border-slate-200 text-slate-700 rounded-tl-none'}`}
                        >
                            {/* 锁定文字颜色，防止变白 */}
                            <span style={{ color: isAgent ? '#ffffff' : '#334155' }}>{msg.content}</span>
                        </div>
                    )}

                    {/* 消息标签展示 */}
                    {msgTags.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                            {msgTags.map((tag, idx) => (
                                <span 
                                    key={idx} 
                                    className="text-[9px] font-black px-2 py-0.5 rounded-md border tracking-tighter"
                                    style={{ color: tag.color, backgroundColor: `${tag.color}15`, borderColor: `${tag.color}30` }}
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
});

const SessionDetailModal = ({ isOpen, onClose, session, initialMessages = [], readOnly = false }) => {
    // --- 状态 ---
    const [messages, setMessages] = useState(initialMessages);
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState([]); // 消息级标签
    const [sessionTags, setSessionTags] = useState([]); // 会话级标签
    const [availableTags, setAvailableTags] = useState([]); // 平铺后的备选池
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [inlineEditValue, setInlineEditValue] = useState('');

    const draftKey = `session_draft_v6_${session?.id}`;
    const messageRefs = useRef({});

    // --- 标签树平铺算法 ---
    const flattenTags = useCallback((tagTree) => {
        let result = [];
        tagTree.forEach(tag => {
            result.push({ id: tag.id, name: tag.name, color: tag.color, usage_count: tag.usage_count });
            if (tag.children && tag.children.length > 0) {
                result = result.concat(flattenTags(tag.children));
            }
        });
        return result;
    }, []);

    // --- 加载数据 ---
    useEffect(() => {
        const loadAvailableTags = async () => {
            try {
                const res = await qualityAPI.getAllTags();
                const flattened = flattenTags(res.data.data || []);
                setAvailableTags(flattened.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)));
            } catch (e) { console.error('标签加载失败'); }
        };
        if (isOpen) loadAvailableTags();
    }, [isOpen, flattenTags]);

    useEffect(() => {
        if (isOpen && session) {
            setMessages(initialMessages);
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    setRating(draft.rating || 0);
                    setEditContent(draft.editContent || '');
                    setTags(draft.tags || []);
                    setSessionTags(draft.sessionTags || []);
                } catch(e) {}
            } else {
                setRating(session.score ? Math.round(session.score / 20) : 0);
                setEditContent(session.comment || '');
                setSessionTags(session.tags || []);
                const allMsgTags = [];
                initialMessages.forEach(msg => {
                    if (msg.tags) msg.tags.forEach(t => allMsgTags.push({ messageId: msg.id, tagId: t.id, text: t.name, color: t.color }));
                });
                setTags(allMsgTags);
            }
        }
    }, [isOpen, session, initialMessages, draftKey]);

    // --- 快捷操作 ---
    const toggleTag = (tag) => {
        if (selectedMessageId) {
            setTags(prev => {
                const isExist = prev.find(t => t.messageId === selectedMessageId && t.tagId === tag.id);
                if (isExist) return prev.filter(t => !(t.messageId === selectedMessageId && t.tagId === tag.id));
                return [...prev, { messageId: selectedMessageId, tagId: tag.id, text: tag.name, color: tag.color }];
            });
        } else {
            setSessionTags(prev => {
                const isExist = prev.find(t => t.id === tag.id);
                if (isExist) return prev.filter(t => t.id !== tag.id);
                return [...prev, tag];
            });
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await qualityAPI.submitReview(session.id, {
                score: rating * 20,
                grade: (rating * 20) >= 90 ? 'A' : (rating * 20) >= 80 ? 'B' : 'C',
                comment: editContent,
                session_tags: sessionTags,
                message_tags: tags
            });
            localStorage.removeItem(draftKey);
            toast.success('质检数据同步成功');
            onClose();
        } catch (e) { toast.error('保存失败'); }
        setIsSaving(false);
    };

    const activeTagIds = useMemo(() => {
        if (selectedMessageId) return tags.filter(t => t.messageId === selectedMessageId).map(t => t.tagId);
        return sessionTags.map(t => t.id);
    }, [tags, sessionTags, selectedMessageId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px] p-4 md:p-8">
            <div className="bg-white w-full h-full max-w-[1440px] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-300">
                
                <header className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
                            <MessageSquare size={16} strokeWidth={3} />
                        </div>
                        <h2 className="text-sm font-black text-slate-900 tracking-tight">质检工作台 <span className="ml-2 font-mono text-slate-400">#{session?.session_code}</span></h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={18} /></button>
                </header>

                <div className="flex-1 flex overflow-hidden bg-slate-50/20">
                    {/* 左侧：聊天主轴 */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {messages.map((msg) => (
                            <MessageItem 
                                key={msg.id}
                                msg={msg}
                                isSelected={selectedMessageId === msg.id}
                                isEditing={editingMessageId === msg.id}
                                msgTags={tags.filter(t => t.messageId === msg.id)}
                                onSelect={setSelectedMessageId}
                                onEditStart={(id, val) => { setEditingMessageId(id); setInlineEditValue(val); }}
                                onEditSave={async (id) => {
                                    try {
                                        await qualityAPI.updateMessage(id, { content: inlineEditValue });
                                        setMessages(m => m.map(item => item.id === id ? {...item, content: inlineEditValue} : item));
                                        setEditingMessageId(null);
                                        toast.success('已修正');
                                    } catch(e) { toast.error('修改失败'); }
                                }}
                                onEditCancel={() => setEditingMessageId(null)}
                                inlineValue={inlineEditValue}
                                setInlineValue={setInlineEditValue}
                                readOnly={readOnly}
                            />
                        ))}
                    </div>

                    {/* 右侧：侧边栏 */}
                    <aside className="w-[320px] border-l border-slate-100 bg-white flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                            
                            {/* 1. 评分 */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Star size={12} className="text-amber-500" /> 会话总分
                                </h3>
                                <div className="flex items-center justify-between bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} onClick={() => !readOnly && setRating(star)} className={`transition-all ${star <= rating ? 'text-amber-400 scale-110' : 'text-slate-200'}`}>
                                                <Star size={24} fill={star <= rating ? "currentColor" : "none"} strokeWidth={3} />
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-2xl font-black text-slate-800 tracking-tighter">{rating * 20}</span>
                                </div>
                            </section>

                            {/* 2. 标签云 (平铺模式) */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <TagIcon size={12} className="text-indigo-500" /> 快捷打标
                                </h3>
                                
                                <div className={`p-3 rounded-xl transition-all border ${selectedMessageId ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-white'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider">
                                            {selectedMessageId ? '正在标记当前对话' : '正在标记整体会话'}
                                        </span>
                                        {selectedMessageId && <RotateCcw size={12} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => setSelectedMessageId(null)} />}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {availableTags.length > 0 ? availableTags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag(tag)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                                                activeTagIds.includes(tag.id)
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-300'
                                            }`}
                                        >
                                            {tag.name}
                                        </button>
                                    )) : <span className="text-[10px] text-slate-300">暂无可用标签</span>}
                                </div>
                            </section>

                            {/* 3. 评语 */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Edit3 size={12} className="text-emerald-500" /> 质检建议
                                </h3>
                                <textarea 
                                    className="w-full h-32 bg-slate-50 border border-slate-100 rounded-xl p-4 text-[12px] font-medium text-slate-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none resize-none"
                                    placeholder="输入评语..."
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                />
                            </section>
                        </div>

                        {!readOnly && (
                            <footer className="p-6 border-t border-slate-50 bg-white shrink-0 space-y-3">
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isSaving}
                                    className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                                >
                                    {isSaving ? <RotateCcw size={14} className="animate-spin" /> : <Save size={14} />}
                                    确认并同步
                                </button>
                                <button 
                                    onClick={() => { setRating(5); setEditContent('话术标准，服务专业。'); }}
                                    className="w-full h-10 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    一键满分
                                </button>
                            </footer>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default SessionDetailModal;
