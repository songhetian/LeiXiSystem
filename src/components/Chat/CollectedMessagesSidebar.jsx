import React from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import TextMessage from './Messages/TextMessage';
import ImageMessage from './Messages/ImageMessage';
import FileMessage from './Messages/FileMessage';
import VoiceMessage from './Messages/VoiceMessage';
import VideoMessage from './Messages/VideoMessage';

const CollectedMessagesSidebar = ({ collectedMessages, onClose, onUncollectMessage, userId }) => {
  const renderCollectedMessage = (message) => {
    const isSender = message.sender_id === userId; // Assuming sender_id is available in collected message
    switch (message.message_type) {
      case 'text':
        return <TextMessage key={message.id} message={message} isSender={isSender} />;
      case 'image':
        return <ImageMessage key={message.id} message={message} isSender={isSender} />;
      case 'file':
        return <FileMessage key={message.id} message={message} isSender={isSender} />;
      case 'voice':
        return <VoiceMessage key={message.id} message={message} isSender={isSender} />;
      case 'video':
        return <VideoMessage key={message.id} message={message} isSender={isSender} />;
      default:
        return <TextMessage key={message.id} message={{ ...message, content: `Unsupported message type: ${message.message_type}` }} isSender={isSender} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-80 bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Collected Messages</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {collectedMessages.length === 0 ? (
          <p className="text-gray-500">No collected messages yet.</p>
        ) : (
          collectedMessages.map((collectedMsg) => (
            <div key={collectedMsg.id} className="relative p-3 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-xs text-gray-500 mb-1">
                From {collectedMsg.sender_name} on {new Date(collectedMsg.message_created_at).toLocaleString()}
              </p>
              {renderCollectedMessage(collectedMsg)}
              <button
                onClick={() => onUncollectMessage(collectedMsg.message_id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                title="Uncollect"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CollectedMessagesSidebar;