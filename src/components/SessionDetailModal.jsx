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
    Bookmark,
    ChevronRight,
    Search
} from 'lucide-react';
import { toast } from 'sonner';
import qualityAPI from '../api/qualityAPI';

// --- 性能优化：Memo化的消息条目组件，防止大列表全量重绘 ---
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
    readOnly,
    getContrastColor
}) => {
    const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'customer_service';
    
    return (
        <div 
            className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} group relative transition-all duration-200 mb-8`}
            onClick={() => onSelect(msg.id)}
        >
            <div className={`flex items-end gap-3 max-w-[85%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* 头像 - 保持扁平化 */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-sm shrink-0 ${isAgent ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                    {isAgent ? '客服' : '客户'}
                </div>
                
                <div className="flex flex-col gap-1.5 min-w-0">
                    <div className={`flex items-center gap-2 text-[10px] font-black text-slate-400 mb-0.5 px-1 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                        <span>{isAgent ? '系统席位' : '访客用户'}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>

                    {isEditing ? (
                        <div className="bg-white border-2 border-indigo-500 rounded-xl p-3 w-full min-w-[320px] shadow-2xl animate-in zoom-in-95 duration-200 z-10">
                            <textarea 
                                autoFocus
                                className="w-full text-[13px] text-slate-700 bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[80px] leading-relaxed"
                                value={inlineValue}
                                onChange={e => setInlineValue(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                                <button onClick={onEditCancel} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-3 py-1">取消</button>
                                <button onClick={() => onEditSave(msg.id)} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-lg shadow-md">确认修改</button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <div 
                                onDoubleClick={() => !readOnly && onEditStart(msg.id, msg.content)}
                                className={`px-5 py-3 rounded-2xl text-[13px] leading-relaxed transition-all cursor-pointer border ${
                                    isSelected 
                                        ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-lg border-indigo-100' 
                                        : 'hover:bg-slate-50 border-transparent shadow-sm'
                                } ${isAgent 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white border-slate-200 text-slate-700 rounded-tl-none'}`}
                            >
                                {msg.content}
                            </div>
                            
                            {/* 编辑按钮 - 修正位置，不再与头像重叠 */}
                            {!readOnly && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEditStart(msg.id, msg.content); }}
                                    className={`absolute -top-2 ${isAgent ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white border border-slate-100 rounded-lg shadow-sm text-slate-400 hover:text-indigo-600 hover:scale-110 z-10`}
                                    title="快速修正"
                                >
                                    <Edit3 size={14} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* 消息标签 */}
                    {msgTags.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                            {msgTags.map((tag, idx) => (
                                <span 
                                    key={idx} 
                                    className="text-[9px] font-black px-2 py-0.5 rounded-md border tracking-tight"
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
    const [messages, setMessages] = useState(initialMessages);
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState([]); 
    const [sessionTags, setSessionTags] = useState([]);
    const [availableTags, setAvailableTags] = useState([]); // 备选标签池
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [inlineEditValue, setInlineEditValue] = useState('');

    const draftKey = `session_draft_v4_${session?.id}`;
    const scrollRef = useRef(null);

    // --- 加载可用标签池 ---
    useEffect(() => {
        const loadTags = async () => {
            try {
                const res = await qualityAPI.getAllTags();
                setAvailableTags(res.data.data || []);
            } catch (e) {}
        };
        if (isOpen) loadTags();
    }, [isOpen]);

    // --- 数据同步与草稿 ---
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
                } catch(e) {}
            } else {
                setRating(session.score ? Math.round(session.score / 20) : 0);
                setEditContent(session.comment || '');
                const allTags = [];
                initialMessages.forEach(msg => {
                    if (msg.tags) msg.tags.forEach(t => allTags.push({ messageId: msg.id, tagId: t.id, text: t.name, color: t.color }));
                });
                setTags(allTags);
            }
        }
    }, [isOpen, session, initialMessages, draftKey]);

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
        } catch (error) { toast.error('保存失败'); }
        setIsSaving(false);
    };

    const toggleTag = useCallback((tag) => {
        if (!selectedMessageId) {
            toast.warning('请先点击左侧消息进行打标');
            return;
        }
        setTags(prev => {
            const isExist = prev.find(t => t.messageId === selectedMessageId && t.tagId === tag.id);
            if (isExist) {
                return prev.filter(t => !(t.messageId === selectedMessageId && t.tagId === tag.id));
            }
            return [...prev, { messageId: selectedMessageId, tagId: tag.id, text: tag.name, color: tag.color }];
        });
    }, [selectedMessageId]);

    const currentMsgTags = useMemo(() => 
        tags.filter(t => t.messageId === selectedMessageId).map(t => t.tagId),
    [tags, selectedMessageId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-[2px] p-4 md:p-8">
            <div className="bg-white w-full h-full max-w-[1440px] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-300">
                
                {/* 全中文 Header */}
                <header className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
                            <MessageSquare size={16} strokeWidth={3} />
                        </div>
                        <h2 className="text-sm font-black text-slate-900 tracking-tight">质检分析台 <span className="ml-2 font-mono text-slate-400">#{session?.session_code}</span></h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden lg:flex items-center gap-4 text-[10px] font-bold text-slate-400">
                            <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">{session?.platform}</span>
                            <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">{session?.shop}</span>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={18} /></button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden bg-slate-50/20">
                    {/* 左侧：聊天主轴 (高性能渲染) */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-2 custom-scrollbar">
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
                                        toast.success('修改已生效');
                                    } catch(e) { toast.error('修改失败'); }
                                }}
                                onEditCancel={() => setEditingMessageId(null)}
                                inlineValue={inlineEditValue}
                                setInlineValue={setInlineEditValue}
                                readOnly={readOnly}
                            />
                        ))}
                    </div>

                    {/* 右侧：标签与评价 (降维打击交互) */}
                    <aside className="w-[340px] border-l border-slate-100 bg-white flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                            
                            {/* 1. 评分 */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Star size={12} className="text-amber-500" /> 评分分值
                                    </h3>
                                    <span className="text-2xl font-black text-slate-900 tracking-tighter">{rating * 20}<span className="text-[10px] text-slate-300 ml-1 font-bold">分</span></span>
                                </div>
                                <div className="flex justify-between bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shadow-inner">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button 
                                            key={star}
                                            onClick={() => !readOnly && setRating(star)}
                                            className={`transition-all duration-300 ${star <= rating ? 'text-amber-400 scale-110' : 'text-slate-200 hover:text-amber-200 hover:scale-105'}`}
                                        >
                                            <Star size={26} fill={star <= rating ? "currentColor" : "none"} strokeWidth={3} />
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* 2. 一键打标面板 (极简交互) */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <TagIcon size={12} className="text-indigo-500" /> 快捷标签
                                </h3>
                                {selectedMessageId ? (
                                    <div className="animate-in slide-in-from-right-4 duration-300">
                                        <div className="bg-slate-900 rounded-xl p-3 mb-4 shadow-lg flex items-center justify-between">
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">正在为当前对话打标</span>
                                            <RotateCcw size={12} className="text-slate-400 cursor-pointer hover:text-white" onClick={() => setSelectedMessageId(null)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableTags.map(tag => (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => toggleTag(tag)}
                                                    className={`group px-3 py-2 rounded-lg text-[11px] font-bold text-left transition-all border relative overflow-hidden ${
                                                        currentMsgTags.includes(tag.id)
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50/30'
                                                    }`}
                                                >
                                                    <span className="relative z-10">{tag.name}</span>
                                                    {/* 高频标签微标识 */}
                                                    {tag.usage_count > 10 && (
                                                        <div className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center ${currentMsgTags.includes(tag.id) ? 'text-indigo-300' : 'text-indigo-400/40'}`}>
                                                            <Star size={8} fill="currentColor" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-2 opacity-60">
                                        <AlertCircle size={24} strokeWidth={1.5} />
                                        <span className="text-[10px] font-bold">请点击左侧对话激活打标</span>
                                    </div>
                                )}
                            </section>

                            {/* 3. 评语 */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Edit3 size={12} className="text-emerald-500" /> 质检总评
                                </h3>
                                <textarea 
                                    readOnly={readOnly}
                                    className="w-full h-36 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[12px] font-medium text-slate-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none resize-none shadow-inner"
                                    placeholder="输入最终改进建议..."
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                />
                            </section>
                        </div>

                        {/* 底部操作 */}
                        {!readOnly && (
                            <footer className="p-6 border-t border-slate-50 bg-white shrink-0 space-y-3">
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isSaving}
                                    className="w-full h-11 bg-slate-950 hover:bg-black text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isSaving ? <RotateCcw size={14} className="animate-spin" /> : <Save size={14} />}
                                    提交质检结果
                                </button>
                                <button 
                                    onClick={() => { setRating(5); setEditContent('服务规范，业务熟练，表现优秀。'); }}
                                    className="w-full h-10 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    ✨ 一键满分通过
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
