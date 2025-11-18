import React, { useRef, useEffect } from 'react';

const ChatWindow = ({ selectedConversation, messages, renderMessage, typingUsers, userId, searchResults, searchQuery, onReply, onClearHistory, onLoadMoreMessages, hasMoreMessages, isLoadingMessages }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, searchResults]); // Add searchResults to dependencies

  const highlightText = (text, highlight) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  if (!selectedConversation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        Select a conversation to start chatting.
      </div>
    );
  }

  const getTypingUsers = () => {
    const typingUserIds = Object.keys(typingUsers).filter(
      (id) => typingUsers[id] && parseInt(id) !== userId
    );
    if (typingUserIds.length === 0) return null;

    // In a real app, you'd fetch user names from a user list
    const names = typingUserIds.map(id => `User ${id}`).join(', ');
    return `${names} is typing...`;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">
          {selectedConversation.name || 'Unknown Conversation'}
        </h2>
        {/* Could add conversation settings/info button here */}
        <div className="flex items-center space-x-2">
          <button className="text-gray-500 hover:text-gray-700" onClick={onClearHistory}>
            {/* Icon for clear history */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button className="text-gray-500 hover:text-gray-700">
            {/* Icon for settings or info */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages && (
          <div className="flex justify-center mb-4">
            <p className="text-gray-500 text-sm">Loading messages...</p>
          </div>
        )}
        {hasMoreMessages && !searchQuery && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onLoadMoreMessages}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
            >
              Load More Messages
            </button>
          </div>
        )}
        {searchQuery && searchResults.length > 0 ? (
          <div className="flex flex-col">
            <p className="text-center text-gray-600 text-sm mb-4">
              Found {searchResults.length} results for "{searchQuery}"
            </p>
            {searchResults.map((message) => (
              <div key={message.id} className="mb-2 p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  {message.sender_name} at {new Date(message.created_at).toLocaleString()}
                </p>
                <p className="text-sm">{highlightText(message.content, searchQuery)}</p>
              </div>
            ))}
          </div>
        ) : searchQuery && searchResults.length === 0 ? (
          <p className="text-center text-gray-600 text-sm">No results found for "{searchQuery}"</p>
        ) : (
          messages.map((message) => renderMessage(message, onReply))
        )}
        {getTypingUsers() && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
              {getTypingUsers()}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;