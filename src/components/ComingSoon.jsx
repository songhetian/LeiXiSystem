import React from 'react'

const ComingSoon = ({ title }) => {
  return (
    <div className="flex items-center justify-center h-full bg-primary-50">
      <div className="text-center">
        <div className="text-8xl mb-6">🚧</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">{title}</h2>
        <p className="text-gray-600 text-lg mb-6">功能开发中，敬请期待...</p>
        <div className="inline-block px-6 py-3 bg-primary-100 text-primary-700 rounded-lg">
          Coming Soon
        </div>
      </div>
    </div>
  )
}

export default ComingSoon
