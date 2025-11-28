import React from 'react'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
                <div className="text-8xl mb-4">404</div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">页面未找到</h1>
                <p className="text-gray-600 mb-6">
                    抱歉,您访问的页面不存在或已被移除
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                    >
                        返回上页
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                    >
                        返回首页
                    </button>
                </div>
            </div>
        </div>
    )
}
