import React from 'react';

const GroupInfo = ({ group }) => {
  if (!group) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        No group selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white p-4">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Group Information</h2>

      <div className="flex items-center space-x-4 mb-6">
        <img
          className="w-20 h-20 rounded-full object-cover"
          src={group.avatar || 'https://via.placeholder.com/80'}
          alt={group.name}
        />
        <div>
          <p className="text-lg font-medium text-gray-900">{group.name}</p>
          <p className="text-sm text-gray-500">{group.description}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-md font-semibold text-gray-700 mb-2">Announcement</h3>
        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
          {group.announcement || 'No announcement yet.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <h3 className="text-md font-semibold text-gray-700 mb-2">Members ({group.members ? group.members.length : 0})</h3>
        <ul className="space-y-2">
          {group.members && group.members.map((member) => (
            <li key={member.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-md">
              <img
                className="w-8 h-8 rounded-full object-cover"
                src={member.avatar || 'https://via.placeholder.com/32'}
                alt={member.name}
              />
              <p className="text-sm text-gray-800">{member.name} {member.role && `(${member.role})`}</p>
              {/* Add member management actions here (e.g., remove, change role) */}
            </li>
          ))}
        </ul>
      </div>

      {/* Group management actions (e.g., Edit Group, Leave Group, Disband Group) */}
      <div className="mt-6 border-t border-gray-200 pt-4 space-y-3">
        <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Edit Group Info
        </button>
        <button className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
          Leave Group
        </button>
        {/* Only owner can disband */}
        {group.isOwner && (
          <button className="w-full px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800">
            Disband Group
          </button>
        )}
      </div>
    </div>
  );
};

export default GroupInfo;