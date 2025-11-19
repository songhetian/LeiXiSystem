import React, { useEffect, useState } from 'react'

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

  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-out"></div>
      <div className={`relative z-10 bg-white rounded-xl shadow-2xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-hidden transform transition-all duration-200 ease-out ${entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {children}
        </div>
        {footer && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
