import React, { useState } from 'react';
import Modal from './Modal';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'danger',
  isLoading = false,
  zIndex = 4000
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (isLoading || isConfirming) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      zIndex={zIndex}
    >
      <div className="space-y-6">
        <div className="text-gray-700">
          {typeof message === 'string' ? (
            <p className="whitespace-pre-line">{message}</p>
          ) : (
            message
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={isConfirming || isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || isLoading}
            className={`px-4 py-2 text-white rounded-lg ${
              confirmVariant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : confirmVariant === 'primary'
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'bg-blue-500 hover:bg-blue-600'
            } disabled:opacity-50`}
          >
            {(isConfirming || isLoading) ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {confirmText}
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
