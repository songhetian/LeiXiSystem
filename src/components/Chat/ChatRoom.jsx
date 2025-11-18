import React from 'react';
import ChatWindow from './ChatWindow'; // Reuse ChatWindow for message display
import MessageInput from './MessageInput'; // Reuse MessageInput

const ChatRoom = ({ selectedChatRoom, onSendMessage, onlineMembers }) => {
  if (!selectedChatRoom) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        Select a chat room to join.
      </div>
    );
  }

  const handleSendMessage = (messageData) => {
    // In a real application, this would emit a WebSocket event for the chat room
    console.log('Sending message to chat room:', selectedChatRoom.name, messageData);
    onSendMessage({ ...messageData, conversation_id: selectedChatRoom.id });
  };

  return (
    <div className="flex h-full bg-white">
      {/* Main Chat Area (reusing ChatWindow structure) */}
      <div className="flex flex-col flex-1">
        {/* Chat Header for Room */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {selectedChatRoom.name || 'Unknown Chat Room'}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{onlineMembers.length} Online</span>
            {/* Could add room settings/info button here */}
            <button className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
              Join/Leave
            </button>
          </div>
        </div>

        {/* Message List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Messages will be rendered here, potentially using dynamic message components */}
          <div className="flex justify-start">
            <div className="bg-gray-200 p-3 rounded-lg max-w-xs">
              <p className="text-sm">Welcome to {selectedChatRoom.name}!</p>
              <span className="text-xs text-gray-500 block text-right">System</span>
            </div>
          </div>
          {/* Example of a message, this would come from props/state */}
          <div className="flex justify-start">
            <div className="bg-gray-200 p-3 rounded-lg max-w-xs">
              <p className="text-sm">Some user sent a message.</p>
              <span className="text-xs text-gray-500 block text-right">10:00 AM</span>
            </div>
          </div>
        </div>

        {/* Message Input */}
        <MessageInput onSendMessage={handleSendMessage} />
      </div>

      {/* Online Members Sidebar (Optional) */}
      <div className="w-64 bg-gray-50 border-l border-gray-200 p-4 hidden md:block">
        <h3 className="text-md font-semibold text-gray-700 mb-4">Online Members</h3>
        <ul className="space-y-2">
          {onlineMembers.map((member) => (
            <li key={member.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-md">
              <img
                className="w-8 h-8 rounded-full object-cover"
                src={member.avatar || 'https://via.placeholder.com/32'}
                alt={member.name}
              />
              <p className="text-sm text-gray-800">{member.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ChatRoom;
