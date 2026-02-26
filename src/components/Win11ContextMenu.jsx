import React, { useEffect, useRef, useState } from 'react';

const Win11ContextMenu = ({ x, y, visible, onClose, items }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let timer;
    if (visible) {
      // 延迟 50ms 渲染，躲避触发右键时的点击事件冒泡
      timer = setTimeout(() => setShouldRender(true), 50);
      
      const handleGlobalClose = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
          onClose();
        }
      };

      window.addEventListener('mousedown', handleGlobalClose);
      window.addEventListener('scroll', onClose, true);
      window.addEventListener('resize', onClose);

      return () => {
        window.removeEventListener('mousedown', handleGlobalClose);
        window.removeEventListener('scroll', onClose, true);
        window.removeEventListener('resize', onClose);
        clearTimeout(timer);
      };
    } else {
      setShouldRender(false);
    }
  }, [visible, onClose]);

  if (!visible || !shouldRender || !items || items.length === 0) return null;

  // 边界检查
  const menuWidth = 180;
  const menuHeight = items.length * 38;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] w-[180px] bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
          className="w-full text-left px-4 py-2.5 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-3 group"
        >
          <span className="text-base group-hover:scale-110 transition-transform">{item.icon}</span>
          <span className="text-[11px] font-black tracking-tight">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Win11ContextMenu;
