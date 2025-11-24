import React, { useEffect } from 'react'

const Modal = ({ isOpen, onClose, title, children, size = 'medium', footer, zIndex = 1000 }) => {
  if (!isOpen) return null

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    xlarge: 'max-w-6xl',
    full: 'max-w-7xl',
    wide: 'max-w-[85vw]'
  }

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex }}>
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      ></div>
      <div
        className={`relative z-10 bg-white rounded-lg shadow-lg ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            aria-label="关闭"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {children}
        </div>
        {footer && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
