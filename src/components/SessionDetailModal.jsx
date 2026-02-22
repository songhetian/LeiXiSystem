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
    Layers,
    LayoutList,
    Search,
    Flame,
    CheckCircle2
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
            className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} group relative mb-10`}
            onClick={() => onSelect(msg.id)}
        >
            <div className={`flex items-end gap-4 max-w-[85%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* 扁平化头像 */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-sm shrink-0 ${isAgent ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                    {isAgent ? '客服' : '客户'}
                </div>
                
                <div className="flex flex-col gap-1.5 min-w-0">
                    {!readOnly && !isEditing && (
                        <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity mb-1`}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEditStart(msg.id, msg.content); }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white shadow-sm text-slate-400 hover:text-emerald-600 rounded-lg border border-slate-100 text-[10px] font-black"
                            >
                                <Edit3 size={10} /> 修正对话内容
                            </button>
                        </div>
                    )}

                    {isEditing ? (
                        <div className="bg-white border-2 border-emerald-500 rounded-2xl p-4 w-full min-w-[380px] shadow-2xl z-50">
                            <textarea 
                                autoFocus
                                className="w-full text-sm text-slate-700 bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[100px] leading-relaxed"
                                value={inlineValue}
                                onChange={e => setInlineValue(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-50">
                                <button onClick={onEditCancel} className="text-[11px] font-bold text-slate-400 px-3 py-1">放弃</button>
                                <button onClick={() => onEditSave(msg.id)} className="bg-emerald-600 text-white text-[11px] font-black px-5 py-2 rounded-xl shadow-lg">保存更改</button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            className={`message-bubble-container px-6 py-4 rounded-2xl text-[14px] leading-relaxed cursor-pointer border ${
                                isSelected ? 'message-selected' : 'message-hover border-slate-100'
                            } ${isAgent ? 'bg-indigo-600' : 'bg-white shadow-sm'}`}
                        >
                            <span className={isAgent ? 'message-text-white' : 'message-text-slate'}>{msg.content}</span>
                        </div>
                    )}

                    {msgTags.length > 0 && (
                        <div className={`flex flex-wrap gap-1.5 mt-2 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                            {msgTags.map((tag, idx) => (
                                <span 
                                    key={idx} 
                                    className="text-[10px] font-black px-2 py-0.5 rounded-md border tracking-tight shadow-sm"
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
    const [availableTags, setAvailableTags] = useState([]); 
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [inlineEditValue, setInlineEditValue] = useState('');
    
    const [activeTab, setActiveTab] = useState('session'); 
    const [tagSearch, setTagSearch] = useState('');

    const draftKey = `session_draft_v11_${session?.id}`;
    const messageRefs = useRef({});

    useEffect(() => {
        if (selectedMessageId) setActiveTab('message');
    }, [selectedMessageId]);

    const flattenTags = useCallback((tagTree) => {
        let result = [];
        tagTree.forEach(tag => {
            result.push({ id: tag.id, name: tag.name, color: tag.color, usage_count: tag.usage_count, category: tag.category_name || '常规' });
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
                const allTags = [];
                initialMessages.forEach(msg => {
                    if (msg.tags) msg.tags.forEach(t => allTags.push({ messageId: msg.id, tagId: t.id, text: t.name, color: t.color }));
                });
                setTags(allTags);
            }
        }
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
            await qualityAPI.submitReview(session.id, {
                score: rating * 20, grade: (rating * 20) >= 90 ? 'A' : (rating * 20) >= 80 ? 'B' : 'C',
                comment: editContent, session_tags: sessionTags, message_tags: tags
            });
            localStorage.removeItem(draftKey);
            toast.success('同步成功');
            onClose();
        } catch (e) { toast.error('同步失败'); }
        setIsSaving(false);
    };

    const activeTagIds = useMemo(() => {
        return (activeTab === 'message' && selectedMessageId) ? tags.filter(t => t.messageId === selectedMessageId).map(t => t.tagId) : sessionTags.map(t => t.id);
    }, [tags, sessionTags, selectedMessageId, activeTab]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4 md:p-8">
            <div className="bg-white w-full h-full max-w-[1440px] rounded-[40px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-300">
                
                <header className="h-16 border-b border-slate-100 flex items-center justify-between px-10 bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                            <MessageSquare size={20} strokeWidth={3} />
                        </div>
                        <h2 className="text-base font-black text-slate-900 tracking-tight">质检分析工作台 <span className="ml-2 font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border text-xs">#{session?.session_code}</span></h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-400 transition-all active:scale-90"><X size={24} /></button>
                </header>

                <div className="flex-1 flex overflow-hidden bg-slate-50/30">
                    {/* 左侧：聊天轴 */}
                    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                        {messages.map((msg) => (
                            <MessageItem 
                                key={msg.id} msg={msg}
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
                                        toast.success('对话修正成功');
                                    } catch(e) { toast.error('修正失败'); }
                                }}
                                onEditCancel={() => setEditingMessageId(null)}
                                inlineValue={inlineEditValue}
                                setInlineValue={setInlineEditValue}
                                readOnly={readOnly}
                            />
                        ))}
                    </div>

                    {/* 右侧：属性侧边栏 (优化边距与样式) */}
                    <aside className="w-[360px] border-l border-slate-100 bg-white flex flex-col shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
                        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                            
                            {/* 1. 评分模块 - 增加边距与质感 */}
                            <section>
                                <div className="flex items-center justify-between mb-6 px-1">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Star size={12} className="text-amber-500" /> 服务综合评价
                                    </h3>
                                    <div className="px-4 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-lg font-black font-mono">
                                        {rating * 20}
                                    </div>
                                </div>
                                <div className="mx-2 flex justify-center items-center gap-3 py-6 bg-slate-50/50 rounded-[32px] border border-slate-100 shadow-inner">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button 
                                            key={star} 
                                            onClick={() => !readOnly && setRating(star)} 
                                            className={`star-btn ${star <= rating ? 'active text-amber-400 border-amber-200 bg-amber-50/50 shadow-md shadow-amber-100' : 'text-slate-200'}`}
                                        >
                                            <Star size={26} fill={star <= rating ? "currentColor" : "none"} strokeWidth={2.5} />
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* 2. 标签模块 */}
                            <section className="space-y-6">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <TagIcon size={12} className="text-emerald-500" /> 快捷标注体系
                                </h3>

                                {/* 🚀 灵动滑块切换器 */}
                                <div className="mode-tabs-container">
                                    <div className={`mode-slider-indicator ${activeTab === 'session' ? 'slider-left' : 'slider-right'}`} />
                                    <div 
                                        className={`mode-tab-item ${activeTab === 'session' ? 'active' : ''}`} 
                                        onClick={() => setActiveTab('session')}
                                    >
                                        会话整体
                                    </div>
                                    <div 
                                        className={`mode-tab-item ${activeTab === 'message' ? 'active' : ''}`} 
                                        onClick={() => setActiveTab('message')}
                                    >
                                        单条对话
                                    </div>
                                </div>

                                <div className="relative group">
                                    <input 
                                        type="text"
                                        placeholder="搜索或浏览标签..."
                                        value={tagSearch}
                                        onChange={e => setTagSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                                    />
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>

                                <div className="space-y-8 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar px-1">
                                    {!tagSearch && (
                                        <div>
                                            <div className="tag-group-header">常用热门 <Flame size={10} className="text-rose-500" /></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {tagData.frequent.map(tag => (
                                                    <button 
                                                        key={tag.id} 
                                                        onClick={() => toggleTag(tag)} 
                                                        className={`tag-button-standard ${activeTagIds.includes(tag.id) ? 'active' : ''}`}
                                                    >
                                                        {tag.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {Object.entries(tagData.grouped).map(([category, tags]) => (
                                        <div key={category}>
                                            <div className="tag-group-header">{category}</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {tags.map(tag => (
                                                    <button 
                                                        key={tag.id} 
                                                        onClick={() => toggleTag(tag)} 
                                                        className={`tag-button-standard ${activeTagIds.includes(tag.id) ? 'active' : ''}`}
                                                    >
                                                        {tag.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* 3. 评语模块 */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Edit3 size={12} className="text-indigo-500" /> 质检改善建议
                                </h3>
                                <textarea 
                                    className="w-full h-32 bg-slate-50 border border-slate-100 rounded-[24px] p-5 text-[12px] font-medium text-slate-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none resize-none shadow-inner"
                                    placeholder="请输入具体的质检反馈..."
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                />
                            </section>
                        </div>

                        {!readOnly && (
                            <footer className="p-8 border-t border-slate-50 bg-white shrink-0 space-y-3">
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isSaving}
                                    className="w-full h-12 bg-slate-950 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-[0.1em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200"
                                >
                                    {isSaving ? <RotateCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    确认同步分析结果
                                </button>
                                <button 
                                    onClick={() => { setRating(5); setEditContent('服务规范，表现优秀。'); }}
                                    className="w-full h-10 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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
