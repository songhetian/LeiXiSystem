import React from 'react';
import { RightOutlined, HomeOutlined } from '@ant-design/icons';

/**
 * Breadcrumb Component
 *
 * @param {Array} items - Array of breadcrumb items. Each item can be a string or an object { label, onClick? }
 * @example
 * <Breadcrumb items={['首页', '办公协作', '系统广播']} />
 * <Breadcrumb items={[{ label: '首页', onClick: () => navigate('/') }, '系统广播']} />
 */
const Breadcrumb = ({ items = [] }) => {
  return (
    <nav className="flex items-center text-sm text-gray-500" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = typeof item === 'object' ? item.label : item;
          const onClick = typeof item === 'object' ? item.onClick : undefined;

          return (
            <li key={index} className="inline-flex items-center">
              {index > 0 && (
                <RightOutlined className="w-3 h-3 text-gray-400 mx-1 md:mx-2" style={{ fontSize: '12px' }} />
              )}

              <div
                className={`inline-flex items-center ${
                  isLast
                    ? 'text-gray-500 cursor-default'
                    : 'text-gray-700 hover:text-blue-600 cursor-pointer transition-colors duration-200'
                }`}
                onClick={!isLast && onClick ? onClick : undefined}
              >
                {index === 0 && (
                   <HomeOutlined className="mr-1.5" style={{ fontSize: '14px' }} />
                )}
                <span>{label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
