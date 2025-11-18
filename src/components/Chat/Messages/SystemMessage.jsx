import React from 'react';

const SystemMessage = ({ message }) => {
  return (
    <div className="flex justify-center my-2">
      <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
        {message.content}
      </div>
    </div>
  );
};

export default SystemMessage;