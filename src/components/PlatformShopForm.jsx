import React, { useState, useEffect } from 'react';

const PlatformShopForm = ({ entity, onSave, onCancel }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (entity) {
            setName(entity.name || '');
        } else {
            setName('');
        }
    }, [entity]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            return; // Or show a toast message
        }
        onSave({ name });
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    名称
                </label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md shadow-sm"
                    required
                />
            </div>
            <div className="flex justify-end pt-4 space-x-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                >
                    取消
                </button>
                <button
                    type="submit"
                    className="px-6 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700"
                >
                    保存
                </button>
            </div>
        </form>
    );
};

export default PlatformShopForm;
