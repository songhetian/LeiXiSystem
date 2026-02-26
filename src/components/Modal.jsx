import React, { useEffect } from 'react'
import { X } from 'lucide-react'

const Modal = ({ isOpen, onClose, title, children, size = 'medium', footer, zIndex = 3000, noPadding = false }) => {
  if (!isOpen) return null

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    xlarge: 'max-w-6xl',
    ultra: 'max-w-[1100px]',
    mega: 'max-w-[1300px]',
    full: 'max-w-7xl',
    wide: 'max-w-[85vw]',
    xwide: 'max-w-[95vw]'
  }

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      ></div>
      
      {/* Modal Container */}
      <div
        className={`relative z-10 bg-white rounded-[24px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] ${sizeClasses[size]} w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300`}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">{title || '系统提示'}</h2>
            <div className="h-1 w-6 bg-blue-600 rounded-full mt-1"></div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={`${noPadding ? '' : 'px-10 py-8'} overflow-y-auto custom-scrollbar flex-1`}>
          <div className="text-slate-600 font-bold text-sm leading-relaxed">
            {children}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-10 py-6 border-t border-slate-50 bg-slate-50/30 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
