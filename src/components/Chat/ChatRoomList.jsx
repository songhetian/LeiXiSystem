import React from 'react';

const ChatRoomList = ({ chatRooms, onSelectChatRoom, onCreateChatRoom }) => {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Chat Rooms</h2>
        <button
          onClick={onCreateChatRoom}
          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Create Room
        </button>
      </div>
      <div className="p-4 border-b border-gray-200">
        {/* Category filter or search could go here */}
        <input
          type="text"
          placeholder="Search chat rooms..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {chatRooms.length === 0 ? (
          <p className="p-4 text-gray-500">No chat rooms available.</p>
        ) : (
          chatRooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center p-4 space-x-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
              onClick={() => onSelectChatRoom(room)}
            >
              <img
                className="w-10 h-10 rounded-full object-cover"
                src={room.avatar || 'https://via.placeholder.com/40'}
                alt={room.name}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{room.name}</p>
                <p className="text-xs text-gray-500 truncate">{room.description}</p>
              </div>
              <div className="flex-shrink-0 text-xs text-gray-500">
                {room.current_members} online
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatRoomList;