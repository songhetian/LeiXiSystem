import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    X, 
    MessageSquare, 
    Star, 
    Tag, 
    Edit3, 
    Save, 
    RotateCcw, 
    AlertCircle,
    CheckCircle2,
    Bookmark
} from 'lucide-react';
import { toast } from 'sonner';
import qualityAPI from '../api/qualityAPI';
import TagSelector from './TagSelector';
import './SessionDetailModal.css';

/**
 * 质检详情工作台 - 扁平化重构版
 * 设计理念：极简、高效、侧边栏驱动、零干扰交互
 */
const SessionDetailModal = ({ isOpen, onClose, session, initialMessages = [], readOnly = false }) => {
    // --- 核心状态 ---
    const [messages, setMessages] = useState(initialMessages);
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState([]); // 消息级标签映射
    const [sessionTags, setSessionTags] = useState([]); // 会话级标签
    const [editContent, setEditContent] = useState(''); // 质检评语
    const [editingMessageId, setEditingMessageId] = useState(null); // 行内编辑状态
    const [inlineEditValue, setInlineEditValue] = useState('');

    const draftKey = `session_draft_v3_${session?.id}`;
    const messageRefs = useRef({});

    // --- 数据初始化与草稿 ---
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

    useEffect(() => {
        if (isOpen && session) {
            localStorage.setItem(draftKey, JSON.stringify({ rating, editContent, tags }));
        }
    }, [rating, editContent, tags, isOpen, session, draftKey]);

    // --- 快捷键评分 (1-5) ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (readOnly || editingMessageId) return;
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            if (e.key >= '1' && e.key <= '5') {
                setRating(parseInt(e.key));
                toast.info(`评分已更新为 ${e.key} 星`, { duration: 800 });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [readOnly, editingMessageId]);

    // --- 业务逻辑处理 ---
    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const totalScore = rating * 20;
            await qualityAPI.submitReview(session.id, {
                score: totalScore,
                grade: totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 60 ? 'C' : 'D',
                comment: editContent,
                session_tags: sessionTags,
                message_tags: tags
            });
            localStorage.removeItem(draftKey);
            toast.success('质检记录已入库');
            onClose();
        } catch (error) {
            toast.error('保存失败，请检查网络连接');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTagClick = (messageId) => {
        const el = messageRefs.current[messageId];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-pulse');
            setTimeout(() => el.classList.remove('highlight-pulse'), 2000);
            setSelectedMessageId(messageId);
        }
    };

    const getContrastColor = (hex) => {
        if (!hex) return '#475569';
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#1e293b' : '#ffffff';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px] p-4 md:p-10">
            <div className="bg-white w-full h-full max-w-[1400px] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-300">
                
                {/* 极简 Header */}
                <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <MessageSquare size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900 flex items-center gap-3 tracking-tight">
                                质检复盘工作台
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">ID: {session?.session_code}</span>
                            </h2>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{session?.platform}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{session?.shop}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-400 transition-all active:scale-90">
                        <X size={20} />
                    </button>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* 左侧：聊天主轴 */}
                    <main className="flex-1 overflow-y-auto bg-slate-50/20 p-8 space-y-10 custom-scrollbar">
                        {messages.map((msg) => {
                            const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'customer_service';
                            const isSelected = selectedMessageId === msg.id;
                            const isEditing = editingMessageId === msg.id;
                            const msgTags = tags.filter(t => t.messageId === msg.id);

                            return (
                                <div 
                                    key={msg.id} 
                                    ref={el => messageRefs.current[msg.id] = el}
                                    className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} group transition-all`}
                                    onClick={() => setSelectedMessageId(msg.id)}
                                >
                                    <div className={`flex items-end gap-3 max-w-[80%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-sm shrink-0 ${isAgent ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                                            {isAgent ? 'AG' : 'CU'}
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 min-w-0">
                                            <div className={`flex items-center gap-2 text-[10px] font-black text-slate-300 mb-0.5 uppercase tracking-tighter ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                                <span>{isAgent ? 'Support' : 'Client'}</span>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>

                                            {isEditing ? (
                                                <div className="bg-white border-2 border-indigo-500 rounded-2xl p-3 w-full min-w-[350px] shadow-2xl animate-in zoom-in-95 duration-200">
                                                    <textarea 
                                                        autoFocus
                                                        className="w-full text-sm text-slate-700 bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[80px]"
                                                        value={inlineEditValue}
                                                        onChange={e => setInlineEditValue(e.target.value)}
                                                    />
                                                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-50">
                                                        <button onClick={() => setEditingMessageId(null)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-3 py-1">Discard</button>
                                                        <button onClick={() => handleInlineEditSave(msg.id)} className="bg-indigo-600 text-white text-[11px] font-black px-4 py-1.5 rounded-lg shadow-md shadow-indigo-100">Update</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div 
                                                    onDoubleClick={() => !readOnly && (setEditingMessageId(msg.id), setInlineEditValue(msg.content))}
                                                    className={`px-5 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-all cursor-pointer relative ${
                                                        isSelected 
                                                            ? 'ring-2 ring-indigo-500 ring-offset-2 scale-[1.01]' 
                                                            : 'hover:bg-slate-50 border border-transparent'
                                                    } ${isAgent ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border-slate-200 text-slate-700 rounded-tl-none'}`}
                                                >
                                                    {msg.content}
                                                    {!readOnly && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingMessageId(msg.id); setInlineEditValue(msg.content); }}
                                                            className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-300 hover:text-indigo-500"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {msgTags.length > 0 && (
                                                <div className={`flex flex-wrap gap-1.5 mt-1 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                                    {msgTags.map((tag, idx) => (
                                                        <span 
                                                            key={idx} 
                                                            className="text-[9px] font-black px-2 py-0.5 rounded-md border tracking-tighter"
                                                            style={{ color: tag.color, backgroundColor: `${tag.color}15`, borderColor: `${tag.color}30` }}
                                                        >
                                                            {tag.text.toUpperCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </main>

                    {/* 右侧：极简侧边栏 (Shadcn 风格) */}
                    <aside className="w-[360px] border-l border-slate-100 flex flex-col bg-white shrink-0">
                        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            
                            {/* 评分模块 */}
                            <section>
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Star size={12} className="text-amber-500" /> Rating
                                    </h3>
                                    <span className="text-2xl font-black text-slate-900 tracking-tighter">
                                        {rating * 20}<span className="text-[10px] text-slate-300 ml-1 font-bold">PTS</span>
                                    </span>
                                </div>
                                <div className="flex justify-center gap-2 bg-slate-50/50 rounded-2xl p-5 border border-slate-100 shadow-inner">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button 
                                            key={star}
                                            onClick={() => !readOnly && setRating(star)}
                                            className={`transition-all duration-300 ${star <= rating ? 'text-amber-400 scale-110 drop-shadow-sm' : 'text-slate-200 hover:text-amber-200 hover:scale-105'}`}
                                        >
                                            <Star size={28} fill={star <= rating ? "currentColor" : "none"} strokeWidth={2.5} />
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* 标签联动模块 */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Tag size={12} className="text-indigo-500" /> Annotations
                                </h3>
                                {selectedMessageId ? (
                                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-indigo-600 rounded-xl p-3 mb-4 shadow-lg shadow-indigo-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                <span className="text-[10px] font-black text-white uppercase">Editing Context</span>
                                            </div>
                                            <RotateCcw size={12} className="text-indigo-200 cursor-pointer hover:text-white" onClick={() => setSelectedMessageId(null)} />
                                        </div>
                                        <TagSelector 
                                            flat 
                                            selectedTags={tags.filter(t => t.messageId === selectedMessageId).map(t => ({ id: t.tagId, name: t.text, color: t.color }))}
                                            onTagsChange={(newTags) => {
                                                const others = tags.filter(t => t.messageId !== selectedMessageId);
                                                const news = newTags.map(nt => ({ messageId: selectedMessageId, tagId: nt.id, text: nt.name, color: nt.color }));
                                                setTags([...others, ...news]);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-3 grayscale opacity-60">
                                        <AlertCircle size={32} strokeWidth={1} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Select a message</span>
                                    </div>
                                )}
                            </section>

                            {/* 总评模块 */}
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Edit3 size={12} className="text-emerald-500" /> Final Summary
                                </h3>
                                <textarea 
                                    readOnly={readOnly}
                                    className="w-full h-40 bg-slate-50 border border-slate-100 rounded-2xl p-5 text-[12px] font-medium text-slate-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none resize-none shadow-inner"
                                    placeholder="Provide constructive feedback..."
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                />
                            </section>
                        </div>

                        {/* 固定的操作面板 */}
                        {!readOnly && (
                            <footer className="p-8 border-t border-slate-50 shrink-0 space-y-3">
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isSaving}
                                    className="w-full h-12 bg-slate-950 hover:bg-black text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-slate-200 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isSaving ? <RotateCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    Finalize Report
                                </button>
                                <button 
                                    onClick={() => { setRating(5); setEditContent('Excellent communication skills, adhered to all protocols.'); }}
                                    className="w-full h-10 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    <Bookmark size={14} /> Quick Pass (100)
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
