import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, TagIcon } from '@heroicons/react/24/outline';

const PlatformShopForm = ({ entity, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (entity) {
            setName(entity.name || '');
        } else {
            setName('');
        }
        setError('');
    }, [entity]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('名称不能为空');
            return;
        }
        if (name.trim().length < 2) {
            setError('名称至少需要2个字符');
            return;
        }
        onSave({ name: name.trim() });
    };

    return (
        <form onSubmit={handleSubmit} className="flat-form">
            <div className="form-content">
                <div className="form-group">
                    <label htmlFor="name" className="form-label">
                        <TagIcon className="label-icon" />
                        <span>名称</span>
                        <span className="required-mark">*</span>
                    </label>
                    <div className="input-wrapper">
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError('');
                            }}
                            className={`form-input ${error ? 'input-error' : ''}`}
                            placeholder="请输入名称..."
                            autoFocus
                        />
                    </div>
                </div>
            </div>

            <div className="form-footer">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn-flat btn-cancel"
                >
                    <XCircleIcon className="btn-icon" />
                    取消
                </button>
                <button
                    type="submit"
                    className="btn-flat btn-submit"
                    disabled={!name.trim() || !!error}
                >
                    <CheckCircleIcon className="btn-icon" />
                    保存
                </button>
            </div>

            <style jsx>{`
                .flat-form {
                    display: flex;
                    flex-direction: column;
                    min-height: 200px;
                }

                .form-content {
                    flex: 1;
                    padding: 24px;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 12px;
                }

                .label-icon {
                    width: 18px;
                    height: 18px;
                    color: #6b7280;
                }

                .required-mark {
                    color: #ef4444;
                    font-weight: 700;
                }

                .input-wrapper {
                    position: relative;
                }

                .form-input {
                    width: 100%;
                    padding: 12px 16px;
                    font-size: 15px;
                    color: #111827;
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 10px;
                    transition: all 0.2s ease;
                    outline: none;
                }

                .form-input:hover {
                    background: #ffffff;
                    border-color: #d1d5db;
                }

                .form-input:focus {
                    background: #ffffff;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }

                .form-input.input-error {
                    border-color: #ef4444;
                    background: #fef2f2;
                }

                .form-input.input-error:focus {
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
                }

                .error-message {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 8px;
                    padding: 8px 12px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 6px;
                    color: #dc2626;
                    font-size: 13px;
                    font-weight: 500;
                }

                .error-icon {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                }

                .success-hint {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 8px;
                    padding: 8px 12px;
                    background: #ecfdf5;
                    border: 1px solid #a7f3d0;
                    border-radius: 6px;
                    color: #059669;
                    font-size: 13px;
                    font-weight: 500;
                }

                .success-icon {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                }

                .form-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 24px;
                    background: #f9fafb;
                    border-top: 1px solid #e5e7eb;
                }

                .btn-flat {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 600;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    outline: none;
                }

                .btn-icon {
                    width: 18px;
                    height: 18px;
                }

                .btn-cancel {
                    background: #ffffff;
                    color: #6b7280;
                    border: 2px solid #e5e7eb;
                }

                .btn-cancel:hover {
                    background: #f9fafb;
                    border-color: #d1d5db;
                    color: #374151;
                }

                .btn-cancel:active {
                    transform: scale(0.98);
                }

                .btn-submit {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: 2px solid transparent;
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
                }

                .btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
                    transform: translateY(-1px);
                }

                .btn-submit:active:not(:disabled) {
                    transform: translateY(0);
                }

                .btn-submit:disabled {
                    background: #e5e7eb;
                    color: #9ca3af;
                    cursor: not-allowed;
                    box-shadow: none;
                }

                @media (max-width: 640px) {
                    .form-content {
                        padding: 16px;
                    }

                    .form-footer {
                        padding: 12px 16px;
                        flex-direction: column-reverse;
                    }

                    .btn-flat {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </form>
    );
};

export default PlatformShopForm;
