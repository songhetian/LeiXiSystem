import React, { useEffect, useRef } from 'react';

const Win11ContextMenu = ({
  x,
  y,
  visible,
  onClose,
  items,
  onAction
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  // 计算菜单位置，确保不会超出视窗边界
  const getPosition = () => {
    const menuWidth = 200; // 假设菜单宽度为200px
    const menuHeight = items.length * 32 + 16; // 假设每项高度32px，加上padding

    let left = x;
    let top = y;

    // 检查右侧是否超出边界
    if (x + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }

    // 检查底部是否超出边界
    if (y + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }

    return { left, top };
  };

  const position = getPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-[10000] rounded-lg shadow-lg border border-gray-300 bg-white py-2"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        minWidth: '200px',
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)'
      }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            if (item.action) {
              item.action();
            }
            if (onAction) {
              onAction(item);
            }
            onClose();
          }}
          disabled={item.disabled}
          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${
            item.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-800 hover:bg-blue-100'
          }`}
        >
          {item.icon && <span className="text-base">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Win11ContextMenu;
