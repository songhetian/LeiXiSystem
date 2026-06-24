import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    X, 
    MessageSquare, 
    Star, 
    Tag as TagIcon, 
    Edit3, 
    RotateCcw, 
    Search,
    Flame,
    CheckCircle2,
    Clock,
    User,
    ShieldCheck,
    PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import qualityAPI from '../api/qualityAPI';
import './SessionDetailModal.css';

// --- 1. 消息条目组件 ---
const MessageItem = React.memo(({ 
    msg, 
    isSelected, 
    isEditing, 
    msgTags, 
    onSelect, 
    onEditStart, 
    onEditSave, 
    onEditCancel,
    onAddToCase,
    inlineValue,
    setInlineValue,
    readOnly,
    showTimestamp
}) => {
    const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'customer_service';
    
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col mb-8 relative">
            {showTimestamp && (
                <div className="flex justify-center mb-4">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-400 border border-slate-200/50">
                        <Clock size={10} className="inline mr-1 mb-0.5" />
                        {formatTime(msg.timestamp)}
                    </span>
                </div>
            )}
            
            <div 
                className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} group relative`}
                onClick={() => onSelect(msg.id)}
            >
                <div className={`flex gap-3 max-w-[90%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* 头像 - 严格对齐 */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0 ${isAgent ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : 'bg-slate-700'}`}>
                        {isAgent ? '客服' : '客户'}
                    </div>
                    
                    <div className={`flex flex-col gap-1.5 min-w-0 ${isAgent ? 'items-end' : 'items-start'}`}>
                        {/* 操作工具条 - 移回气泡上方/侧边内部，防止溢出裁剪 */}
                        {!readOnly && !isEditing && (
                            <div className={`flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 mb-1`}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEditStart(msg.id, msg.content); }}
                                    className="flex items-center gap-1 px-2 py-1 bg-white shadow-sm text-slate-500 hover:text-blue-600 rounded-lg border border-slate-100 text-[10px] font-bold"
                                >
                                    <Edit3 size={10} /> 修正内容
                                </button>
                            </div>
                        )}

                        {isEditing ? (
                            <div className="bg-white border-2 border-emerald-500 rounded-xl p-3 w-full min-w-[320px] shadow-2xl z-50 animate-in fade-in" onClick={e => e.stopPropagation()}>
                                <textarea 
                                    autoFocus
                                    className="w-full text-sm text-slate-700 bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[80px] leading-relaxed"
                                    value={inlineValue}
                                    onChange={e => setInlineValue(e.target.value)}
                                />
                                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                                    <button onClick={onEditCancel} className="text-[10px] font-bold text-slate-400 px-3 py-1">取消</button>
                                    <button onClick={() => onEditSave(msg.id)} className="bg-emerald-600 text-white text-[10px] font-black px-4 py-1.5 rounded-lg shadow-md">保存修改</button>
                                </div>
                            </div>
                        ) : (
                            <div 
                                className={`px-5 py-3 rounded-2xl text-[13px] leading-relaxed cursor-pointer transition-all duration-200 border-2 ${
                                    isSelected 
                                        ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg z-20' 
                                        : 'border-transparent shadow-sm hover:border-blue-600 hover:shadow-blue-50'
                                } ${isAgent ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white' : 'bg-white text-slate-700'}`}
                            >
                                {msg.content}
                            </div>
                        )}

                        {/* 消息标签 */}
                        {msgTags.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                {msgTags.map((tag, idx) => (
                                    <span 
                                        key={idx} 
                                        className="text-[9px] font-black px-2 py-0.5 rounded-md border shadow-sm"
                                        style={{ color: tag.color, backgroundColor: `${tag.color}10`, borderColor: `${tag.color}30` }}
                                    >
                                        {tag.text}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- 2. 主弹窗组件 ---
const SessionDetailModal = ({ isOpen, onClose, session, initialMessages = [], readOnly = false }) => {
    const [messages, setMessages] = useState(initialMessages);
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState([]); 
    const [sessionTags, setSessionTags] = useState([]);
    const [availableTags, setAvailableTags] = useState([]); 
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [inlineEditValue, setInlineEditValue] = useState('');
    
    const [activeTab, setActiveTab] = useState('session'); 
    const [tagSearch, setTagSearch] = useState('');

    const draftKey = `session_draft_v15_${session?.id}`;
    const initializedIdRef = useRef(null);

    useEffect(() => {
        if (isOpen && session && initializedIdRef.current === session.id) {
            const draft = { rating, editContent, tags, sessionTags };
            localStorage.setItem(draftKey, JSON.stringify(draft));
        }
    }, [rating, editContent, tags, sessionTags, isOpen, session, draftKey]);

    useEffect(() => {
        const handleEscape = (e) => { if (isOpen && e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const flattenTags = useCallback((tagTree) => {
        let result = [];
        tagTree.forEach(tag => {
            result.push({ id: tag.id, name: tag.name, color: tag.color, usage_count: tag.usage_count, category: tag.category_name || '常规标签' });
            if (tag.children && tag.children.length > 0) result = result.concat(flattenTags(tag.children));
        });
        return result;
    }, []);

    useEffect(() => {
        const loadTags = async () => {
            try {
                const res = await qualityAPI.getTags();
                setAvailableTags(flattenTags(res.data.data || []));
            } catch (e) {}
        };
        if (isOpen) loadTags();
    }, [isOpen, flattenTags]);

    const tagData = useMemo(() => {
        const search = tagSearch.trim().toLowerCase();
        let list = availableTags;
        if (search) list = list.filter(t => t.name.toLowerCase().includes(search));
        const frequent = [...availableTags].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 8);
        const grouped = list.reduce((acc, tag) => {
            const cat = tag.category;
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(tag);
            return acc;
        }, {});
        return { frequent, grouped };
    }, [availableTags, tagSearch]);

    useEffect(() => {
        if (isOpen && session && initializedIdRef.current !== session.id) {
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
                const allTags = [];
                initialMessages.forEach(msg => {
                    if (msg.tags) msg.tags.forEach(t => allTags.push({ messageId: msg.id, tagId: t.id, text: t.name, color: t.color }));
                });
                setTags(allTags);
            }
            initializedIdRef.current = session.id;
        }
        if (!isOpen) initializedIdRef.current = null;
    }, [isOpen, session, initialMessages, draftKey]);

    const toggleTag = (tag) => {
        if (activeTab === 'message' && selectedMessageId) {
            setTags(prev => {
                const exist = prev.find(t => t.messageId === selectedMessageId && t.tagId === tag.id);
                return exist ? prev.filter(t => !(t.messageId === selectedMessageId && t.tagId === tag.id)) : [...prev, { messageId: selectedMessageId, tagId: tag.id, text: tag.name, color: tag.color }];
            });
        } else {
            setSessionTags(prev => {
                const exist = prev.find(t => t.id === tag.id);
                return exist ? prev.filter(t => t.id !== tag.id) : [...prev, tag];
            });
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const totalScore = rating * 20;
            const qualityGrade = totalScore >= 90 ? '优' : (totalScore >= 80 ? '良' : (totalScore >= 60 ? '中' : '差'));
            await qualityAPI.submitReview(session.id, {
                score: totalScore, grade: qualityGrade,
                comment: editContent, session_tags: sessionTags, message_tags: tags
            });
            localStorage.removeItem(draftKey);
            toast.success('质检结果已同步保存');
            onClose();
        } catch (e) { toast.error('保存失败，请检查网络'); }
        setIsSaving(false);
    };

    const handleAddToCase = async () => {
        try {
            // 将整个对话历史序列化
            const sessionContent = messages.map(m => `[${m.sender_type === 'agent' ? '客服' : '客户'}] ${m.content}`).join('\n');
            
            // 补充必填字段，解决后端验证失败问题
            const payload = {
                title: `${session.customer_service_name || '客服'} - 质检案例 #${session.session_code}`,
                category: session.platform_name || '常规案例', // 后端必填：分类
                problem_description: `对话详情：\n${sessionContent}`, // 后端必填：问题描述
                solution: editContent || '质检专家给出的改进建议：服务规范，保持沟通。', // 后端必填：解决方案
                case_type: (rating * 20) >= 80 ? 'excellent' : 'bad',
                difficulty_level: 'medium', // 补充非必填但建议项
                status: 'published',
                session_id: session.id,
                tags: JSON.stringify(sessionTags.map(t => t.name))
            };

            await qualityAPI.createCase(payload);
            toast.success('整场会话已作为案例成功入库');
        } catch (e) { 
            const errorMsg = e.response?.data?.message || '存入案例库失败';
            toast.error(`操作失败：${errorMsg}`); 
        }
    };

    const activeTagIds = useMemo(() => {
        return (activeTab === 'message' && selectedMessageId) ? tags.filter(t => t.messageId === selectedMessageId).map(t => t.tagId) : sessionTags.map(t => t.id);
    }, [tags, sessionTags, selectedMessageId, activeTab]);

    const shouldShowTimestamp = (currentMsg, prevMsg) => {
        if (!prevMsg) return true;
        return (new Date(currentMsg.timestamp) - new Date(prevMsg.timestamp)) / 60000 > 5;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full h-full max-w-7xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                <header className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                            <ShieldCheck size={18} />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-sm font-black text-slate-800">服务质检工作台</h2>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">会话: {session?.session_code}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <User size={14} />
                            <span className="text-[11px] font-bold">客服: {session?.customer_service_name || session?.agent_name}</span>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden bg-slate-50/30">
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                <MessageSquare size={48} className="opacity-10" />
                                <p className="text-[10px] font-black uppercase tracking-widest">无对话内容</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => (
                                <MessageItem 
                                    key={msg.id} msg={msg}
                                    isSelected={selectedMessageId === msg.id}
                                    isEditing={editingMessageId === msg.id}
                                    msgTags={tags.filter(t => t.messageId === msg.id)}
                                    onSelect={(id) => { setSelectedMessageId(id); setActiveTab('message'); }}
                                    onEditStart={(id, val) => { setEditingMessageId(id); setInlineEditValue(val); }}
                                    onAddToCase={handleAddToCase}
                                    onEditSave={async (id) => {
                                        try {
                                            await qualityAPI.updateMessage(id, { content: inlineEditValue });
                                            setMessages(m => m.map(item => item.id === id ? {...item, content: inlineEditValue} : item));
                                            setEditingMessageId(null);
                                            toast.success('修正已保存');
                                        } catch(e) { toast.error('修正保存失败'); }
                                    }}
                                    onEditCancel={() => setEditingMessageId(null)}
                                    inlineValue={inlineEditValue}
                                    setInlineValue={setInlineEditValue}
                                    readOnly={readOnly}
                                    showTimestamp={shouldShowTimestamp(msg, messages[index - 1])}
                                />
                            ))
                        )}
                    </div>

                    <aside className="w-80 border-l border-slate-100 bg-white flex flex-col shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.02)]">
                        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                            <section className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Star size={12} className="text-amber-500 fill-amber-500" /> 综合评分指标</h3>
                                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-black shadow-sm">{rating * 20} 分</span>
                                </div>
                                <div className="flex justify-between px-4">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} onClick={() => !readOnly && setRating(star)} className={`transition-all duration-300 transform active:scale-90 ${star <= rating ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'text-slate-200'}`}>
                                            <Star size={26} fill={star <= rating ? "currentColor" : "none"} strokeWidth={star <= rating ? 0 : 2} />
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><TagIcon size={12} className="text-blue-500" /> 质检标签库</h3>
                                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                                        <button className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all duration-200 ${activeTab === 'session' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('session')}>整体会话</button>
                                        <button className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all duration-200 ${activeTab === 'message' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('message')}>单条标注</button>
                                    </div>
                                </div>
                                <div className="relative group">
                                    <input type="text" placeholder="键入关键字筛选标签..." value={tagSearch} onChange={e => setTagSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-all outline-none" />
                                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" />
                                </div>
                                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-5 custom-scrollbar">
                                    {!tagSearch && (
                                        <div className="animate-in fade-in duration-300">
                                            <div className="text-[9px] font-black text-slate-300 uppercase mb-2 flex items-center gap-1.5">常用推荐 <Flame size={10} className="text-orange-500 fill-orange-500" /></div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {tagData.frequent.map(tag => (
                                                    <button key={tag.id} onClick={() => toggleTag(tag)} className={`px-3 py-2 rounded-lg text-[10px] font-black transition-all border text-left truncate ${activeTagIds.includes(tag.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}>{activeTagIds.includes(tag.id) ? '✓ ' : '+ '}{tag.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {Object.entries(tagData.grouped).map(([category, tags]) => (
                                        <div key={category} className="animate-in fade-in slide-in-from-left-1 duration-300">
                                            <div className="text-[9px] font-black text-slate-300 uppercase mb-2 border-l-2 border-slate-100 pl-2">{category}</div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {tags.map(tag => (
                                                    <button key={tag.id} onClick={() => toggleTag(tag)} className={`px-3 py-2 rounded-lg text-[10px] font-black transition-all border text-left truncate ${activeTagIds.includes(tag.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}>{activeTagIds.includes(tag.id) ? '✓ ' : '+ '}{tag.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Edit3 size={12} className="text-indigo-500" /> 改进建议</h3>
                                <textarea className="w-full h-28 bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] font-medium text-slate-600 focus:bg-white focus:ring-4 focus:ring-blue-500/5 outline-none resize-none shadow-inner" placeholder="输入质检反馈..." value={editContent} onChange={e => setEditContent(e.target.value)} />
                            </section>
                        </div>

                        {!readOnly && (
                            <footer className="p-6 border-t border-slate-100 bg-white shrink-0 space-y-2">
                                <button 
                                    onClick={handleSaveAll} 
                                    disabled={isSaving} 
                                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-100"
                                >
                                    {isSaving ? <RotateCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} 
                                    完成并保存质检结果
                                </button>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => handleAddToCase()}
                                        className="h-9 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                        <PlusCircle size={14} className="text-emerald-500" /> 存入案例库
                                    </button>
                                    <button 
                                        onClick={() => { setRating(5); setEditContent('服务规范，表现优秀。'); }} 
                                        className="h-9 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        ✨ 一键满分
                                    </button>
                                </div>
                            </footer>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default SessionDetailModal;
