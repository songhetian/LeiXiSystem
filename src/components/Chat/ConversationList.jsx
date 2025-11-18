import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns'; // Assuming date-fns is available or will be installed

const ConversationList = ({ conversations, onSelectConversation, onSearch }) => {
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleLocalSearchChange = (e) => {
    setLocalSearchQuery(e.target.value);
    onSearch(e.target.value); // Pass the search query up to ChatPage
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Chats</h2>
        {/* Search input */}
        <input
          type="text"
          placeholder="Search conversations..."
          className="w-full px-3 py-2 mt-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={localSearchQuery}
          onChange={handleLocalSearchChange}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="p-4 text-gray-500">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="flex items-center p-4 space-x-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="relative flex-shrink-0">
                <img
                  className="w-10 h-10 rounded-full object-cover"
                  src={conversation.avatar || 'https://via.placeholder.com/40'}
                  alt={conversation.name || 'User'}
                />
                {conversation.unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                    {conversation.unreadCount}
                  </span>
                )}
                {conversation.isMuted && (
                  <span className="absolute bottom-0 right-0 text-gray-400 text-xs">🔇</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conversation.name || 'Unknown'}
                  </p>
                  {conversation.lastMessageTime && (
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(conversation.lastMessageTime), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {conversation.lastMessage || 'No messages yet.'}
                </p>
              </div>
              {conversation.isPinned && (
                <div className="flex-shrink-0 text-blue-500">📌</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;