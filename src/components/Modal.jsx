import React, { useEffect } from 'react'

const Modal = ({ isOpen, onClose, title, children, size = 'medium', footer, zIndex = 1000, variant = 'default' }) => {
  if (!isOpen) return null

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    xlarge: 'max-w-6xl',
    full: 'max-w-7xl',
    wide: 'max-w-[85vw]'
  }

  // Simple color variants
  const variantColors = {
    default: '#3b82f6',
    primary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4'
  }

  const headerColor = variantColors[variant] || variantColors.default

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
        className={`relative z-10 bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-hidden`}
      >
        {title && (
          <div
            className="px-6 py-4 border-b"
            style={{
              backgroundColor: headerColor,
              borderBottomColor: headerColor
            }}
          >
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
