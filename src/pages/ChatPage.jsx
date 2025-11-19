import React, { useState, useEffect } from 'react';
import { connectSocket, disconnectSocket, emitSocketEvent, listenSocketEvent, removeSocketListener } from '../utils/socket';
import ConversationList from '../components/Chat/ConversationList';
import ChatRoomList from '../components/Chat/ChatRoomList';
import ChatRoom from '../components/Chat/ChatRoom';
import GroupInfo from '../components/Chat/GroupInfo';
import ChatWindow from '../components/Chat/ChatWindow';
import MessageInput from '../components/Chat/MessageInput';
import TextMessage from '../components/Chat/Messages/TextMessage';
import ImageMessage from '../components/Chat/Messages/ImageMessage';
import FileMessage from '../components/Chat/Messages/FileMessage';
import VoiceMessage from '../components/Chat/Messages/VoiceMessage';
import VideoMessage from '../components/Chat/Messages/VideoMessage';
import SystemMessage from '../components/Chat/Messages/SystemMessage';
import CollectedMessagesSidebar from '../components/Chat/CollectedMessagesSidebar';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { detectSensitiveWords, showSensitiveWordWarning } from '../utils/sensitiveWords';

const ChatPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(1); // Dummy user ID, replace with actual user ID from auth
  const [token, setToken] = useState('dummy-token'); // Dummy token, replace with actual token
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [messagesToForward, setMessagesToForward] = useState([]);
  const [collectedMessages, setCollectedMessages] = useState([]);
  const [showCollectedMessages, setShowCollectedMessages] = useState(false);
  const [viewMode, setViewMode] = useState('conversation');
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedChatRoom, setSelectedChatRoom] = useState(null);

  useEffect(() => {
    // Connect to WebSocket when component mounts
    connectSocket(userId, token);

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Audio for new messages
    const messageSound = new Audio('/path/to/your/notification.mp3'); // TODO: Replace with actual sound file

    // Listen for incoming messages
    listenSocketEvent('message:receive', (newMessage) => {
      console.log('Received new message:', newMessage);
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setErrorMessage(null); // Clear any previous error messages

      // Display browser notification if not in focus
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(`New message from ${newMessage.sender_name || 'Unknown'}`, {
          body: newMessage.content,
          icon: newMessage.sender_avatar || 'https://via.placeholder.com/40',
        });
      }

      // Play sound alert
      messageSound.play().catch(error => console.error('Error playing sound:', error));
    });

    // Listen for user status updates (online/offline)
    listenSocketEvent('user:status', (data) => {
      console.log('User status update:', data);
      // Update UI to reflect online/offline status
    });

    // Listen for message errors from the server
    listenSocketEvent('message:error', ({ originalMessage, error }) => {
      console.error('Server message error:', error, originalMessage);
      setErrorMessage(error || 'Failed to send message due to a server error.');
    });

    // Listen for typing events
    listenSocketEvent('message:typing', ({ conversationId, userId: typingUserId, isTyping: status }) => {
      if (conversationId === selectedConversation?.id && typingUserId !== userId) {
        setTypingUsers((prev) => ({ ...prev, [typingUserId]: status }));
      }
    });

    listenSocketEvent('conversation:unread:update', (data) => {
      setConversations((prev) => prev.map(c => c.id === data.conversationId ? { ...c, unread_count: data.unreadCount } : c));
    });

    listenSocketEvent('offline:messages', (payload) => {
      const { conversationId, messages: offMsgs } = payload || {};
      if (selectedConversation?.id === conversationId && Array.isArray(offMsgs)) {
        setMessages((prev) => [...prev, ...offMsgs]);
      }
    });

    listenSocketEvent('message:recall', ({ messageId, conversationId }) => {
      if (!conversationId || (selectedConversation && conversationId !== selectedConversation.id)) return;
      setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, content: '这条消息已被撤回', is_recalled: 1, recalled_at: new Date() } : m));
    });

    listenSocketEvent('message:delete', ({ messageId, conversationId }) => {
      if (!conversationId || (selectedConversation && conversationId !== selectedConversation.id)) return;
      setMessages((prev) => prev.filter(m => m.id !== messageId));
    });

    // Clean up on component unmount
    return () => {
      disconnectSocket();
      removeSocketListener('message:receive');
      removeSocketListener('user:status');
      removeSocketListener('message:typing');
      removeSocketListener('conversation:unread:update');
      removeSocketListener('offline:messages');
      removeSocketListener('message:recall');
      removeSocketListener('message:delete');
    };
  }, [userId, token, selectedConversation]); // Add selectedConversation to dependencies

  const fetchConversations = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/chat/conversations'), {
        params: { userId },
      });
      if (response.data.success) {
        setConversations(response.data.data);
      } else {
        console.error('Failed to fetch conversations:', response.data.message);
        setErrorMessage(response.data.message || 'Failed to fetch conversations.');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setErrorMessage('An unexpected error occurred while fetching conversations.');
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [userId]); // Fetch conversations on component mount and userId change

  const [messageLimit, setMessageLimit] = useState(50);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchMessages = async (convId, limit, offset, append = false) => {
    setIsLoadingMessages(true);
    try {
      const response = await axios.get(getApiUrl(`/api/chat/conversations/${convId}/messages`), {
        params: { limit, offset },
      });
      if (response.data.success) {
        const newMessages = response.data.data;
        setMessages((prevMessages) => (append ? [...newMessages, ...prevMessages] : newMessages));
        setHasMoreMessages(newMessages.length === limit);
        setMessageOffset(offset + newMessages.length);
      } else {
        console.error('Failed to fetch messages:', response.data.message);
        setErrorMessage(response.data.message || 'Failed to load messages.');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setErrorMessage('An unexpected error occurred while fetching messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const fetchChatRooms = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/chat/rooms'));
      if (response.data.success) {
        setChatRooms(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    }
  };

  useEffect(() => {
    if (viewMode === 'rooms') {
      fetchChatRooms();
    }
  }, [viewMode]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setMessages([]); // Clear previous messages
    setMessageOffset(0); // Reset offset
    setHasMoreMessages(true); // Assume more messages initially
    fetchMessages(conversation.id, messageLimit, 0); // Fetch initial messages

    // Emit message:read event for all unread messages in this conversation
    // In a real app, you would fetch unread messages and then emit for each
    // For now, let's assume all messages become read upon selection
    emitSocketEvent('message:read', { conversationId: conversation.id, readerId: userId, messageIds: messages.map(msg => msg.id) });
  };

  const handleSelectChatRoom = (room) => {
    setSelectedChatRoom(room);
    setSelectedConversation(null);
  };

  const handleCreateChatRoom = async () => {
    try {
      const response = await axios.post(getApiUrl('/api/chat/rooms'), { name: `Room_${Date.now()}` });
      if (response.data && response.data.success) {
        fetchChatRooms();
      }
    } catch (e) {
      console.error('Create room failed', e);
    }
  };

  const handleLoadMoreMessages = () => {
    if (selectedConversation && hasMoreMessages) {
      fetchMessages(selectedConversation.id, messageLimit, messageOffset, true);
    }
  };

  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { userId: true/false }

  const sensitiveKeywords = ['违规', '非法', '敏感'];
  const containsSensitive = (text) => {
    if (!text) return false;
    return sensitiveKeywords.some((kw) => String(text).includes(kw));
  };

  const handleSendMessage = async (messageData) => {
    // 敏感词检测
    if (messageData.message_type === 'text') {
      const detection = detectSensitiveWords(messageData.content);
      if (detection.hasSensitive) {
        const confirmed = await showSensitiveWordWarning(detection.words);
        if (!confirmed) {
          return; // 用户取消发送
        }
      }
    }

    const messageToSend = {
      conversation_id: selectedConversation.id,
      sender_id: userId,
      recipient_id: selectedConversation.type === 'single' ? selectedConversation.id : null,
      reply_to_message_id: replyToMessage ? replyToMessage.id : null,
      ...messageData,
      created_at: new Date(),
    };

    emitSocketEvent('message:send', messageToSend);
    setMessages((prevMessages) => [...prevMessages, messageToSend]);
    setIsTyping(false);
    emitSocketEvent('message:typing', { conversationId: selectedConversation.id, userId, isTyping: false });
    setReplyToMessage(null);
    setErrorMessage(null);
  };

  const handleSendRoomMessage = async (messageData) => {
    if (!selectedChatRoom) return;

    // 敏感词检测
    if (messageData.message_type === 'text') {
      const detection = detectSensitiveWords(messageData.content);
      if (detection.hasSensitive) {
        const confirmed = await showSensitiveWordWarning(detection.words);
        if (!confirmed) {
          return;
        }
      }
    }

    const payload = {
      room_id: selectedChatRoom.id,
      sender_id: userId,
      ...messageData,
      created_at: new Date()
    };

    emitSocketEvent('room:message', payload);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    try {
      const response = await axios.get(getApiUrl('/api/chat/messages/search'), {
        params: {
          query: query,
          conversationId: selectedConversation ? selectedConversation.id : null, // Search within current conversation or globally
          userId: userId, // Pass current user ID for context
        },
      });
      if (response.data.success) {
        setSearchResults(response.data.data);
      } else {
        console.error('Message search failed:', response.data.message);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error during message search:', error);
      setSearchResults([]);
    }
  };

  const handleImageUpload = async (file) => {
    if (!selectedConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(getApiUrl('/api/upload'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const imageUrl = response.data.url;
        const messageData = {
          conversation_id: selectedConversation.id,
          sender_id: userId,
          recipient_id: selectedConversation.type === 'single' ? selectedConversation.id : null,
          message_type: 'image',
          file_url: imageUrl,
          content: '[Image]', // Placeholder content
          created_at: new Date(),
        };
        emitSocketEvent('message:send', messageData);
        setMessages((prevMessages) => [...prevMessages, messageData]); // Optimistically add message to UI
      } else {
        console.error('Image upload failed:', response.data.error);
        setErrorMessage(response.data.error || 'Failed to upload image.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setErrorMessage('An unexpected error occurred during image upload.');
    }
  };

  const handleFileUpload = async (file) => {
    if (!selectedConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(getApiUrl('/api/upload'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const fileUrl = response.data.url;
        const messageData = {
          conversation_id: selectedConversation.id,
          sender_id: userId,
          recipient_id: selectedConversation.type === 'single' ? selectedConversation.id : null,
          message_type: 'file',
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
          content: `[File: ${file.name}]`, // Placeholder content
          created_at: new Date(),
        };
        emitSocketEvent('message:send', messageData);
        setMessages((prevMessages) => [...prevMessages, messageData]); // Optimistically add message to UI
      } else {
        console.error('File upload failed:', response.data.error);
        setErrorMessage(response.data.error || 'Failed to upload file.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setErrorMessage('An unexpected error occurred during file upload.');
    }
  };

  const handleVoiceRecord = () => {
    console.log('Voice recording initiated (placeholder)');
    // TODO: Implement actual voice recording logic
    alert('Voice recording is not yet implemented.');
  };

  const handleVideoUpload = async (file) => {
    if (!selectedConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(getApiUrl('/api/upload'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const videoUrl = response.data.url;
        const messageData = {
          conversation_id: selectedConversation.id,
          sender_id: userId,
          recipient_id: selectedConversation.type === 'single' ? selectedConversation.id : null,
          message_type: 'video',
          file_url: videoUrl,
          file_name: file.name,
          file_size: file.size,
          content: '[Video]', // Placeholder content
          created_at: new Date(),
        };
        emitSocketEvent('message:send', messageData);
        setMessages((prevMessages) => [...prevMessages, messageData]); // Optimistically add message to UI
      } else {
        console.error('Video upload failed:', response.data.error);
        setErrorMessage(response.data.error || 'Failed to upload video.');
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      setErrorMessage('An unexpected error occurred during video upload.');
    }
  };

  const handleForwardMessage = async (messageId, targetConversationIds) => {
    if (!userId || !messageId || !targetConversationIds || targetConversationIds.length === 0) {
      console.error('Invalid data for message forwarding.');
      return;
    }

    try {
      const response = await axios.post(getApiUrl(`/api/chat/messages/${messageId}/forward`), {
        targetConversationIds,
        senderId: userId,
      });

      if (response.data.success) {
        console.log('Messages forwarded successfully:', response.data.forwardedMessages);
        // Optionally, update UI to show forwarded messages or a success notification
      } else {
        console.error('Message forwarding failed:', response.data.message);
        setErrorMessage(response.data.message || 'Failed to forward message.');
      }
    } catch (error) {
      console.error('Error during message forwarding:', error);
      setErrorMessage('An unexpected error occurred during message forwarding.');
    }
  };

  const handleRecallMessage = async (messageId) => {
    try {
      const response = await axios.put(getApiUrl(`/api/chat/messages/${messageId}/recall`));
      if (response.data && response.data.success) {
        setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, content: '这条消息已被撤回', is_recalled: 1, recalled_at: new Date() } : m));
      }
    } catch (e) {
      console.error('Recall message failed', e);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await axios.delete(getApiUrl(`/api/chat/messages/${messageId}`));
      if (response.data && response.data.success) {
        setMessages((prev) => prev.filter(m => m.id !== messageId));
      }
    } catch (e) {
      console.error('Delete message failed', e);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedConversation || !window.confirm('Are you sure you want to clear chat history for this conversation?')) {
      return;
    }

    try {
      const response = await axios.delete(getApiUrl(`/api/chat/conversations/${selectedConversation.id}/messages`));
      if (response.data.success) {
        setMessages([]); // Clear messages in UI
        console.log('Chat history cleared successfully.');
      } else {
        console.error('Failed to clear chat history:', response.data.message);
        setErrorMessage(response.data.message || 'Failed to clear chat history.');
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      setErrorMessage('An unexpected error occurred while clearing chat history.');
    }
  };

  const handleCollectMessage = async (messageId) => {
    if (!userId || !messageId) {
      console.error('Invalid data for message collection.');
      return;
    }
    try {
      const response = await axios.post(getApiUrl(`/api/chat/messages/${messageId}/collect`), { userId });
      if (response.data.success) {
        console.log('Message collected successfully.');
        // Refresh collected messages list
        fetchCollectedMessages();
      } else {
        console.error('Message collection failed:', response.data.message);
        setErrorMessage(response.data.message || 'Failed to collect message.');
      }
    } catch (error) {
      console.error('Error collecting message:', error);
      setErrorMessage('An unexpected error occurred while collecting message.');
    }
  };

  const handleUncollectMessage = async (messageId) => {
    if (!userId || !messageId) {
      console.error('Invalid data for message uncollection.');
      return;
    }
    try {
      const response = await axios.delete(getApiUrl(`/api/chat/messages/${messageId}/uncollect`), { data: { userId } });
      if (response.data.success) {
        console.log('Message uncollected successfully.');
        // Refresh collected messages list
        fetchCollectedMessages();
      } else {
        console.error('Message uncollection failed:', response.data.message);
        setErrorMessage(response.data.message || 'Failed to uncollect message.');
      }
    } catch (error) {
      console.error('Error uncollecting message:', error);
      setErrorMessage('An unexpected error occurred while uncollecting message.');
    }
  };

  const fetchCollectedMessages = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(getApiUrl('/api/chat/collected-messages'), { params: { userId } });
      if (response.data.success) {
        setCollectedMessages(response.data.data);
      } else {
        console.error('Failed to fetch collected messages:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching collected messages:', error);
    }
  };

  useEffect(() => {
    fetchCollectedMessages();
  }, [userId]); // Fetch collected messages on component mount and userId change

  const handleTyping = (typingStatus) => {
    if (typingStatus !== isTyping) {
      setIsTyping(typingStatus);
      emitSocketEvent('message:typing', { conversationId: selectedConversation.id, userId, isTyping: typingStatus });
    }
  };

  const renderMessage = (message, onReply, onForward, onCollect) => {
    const isSender = message.sender_id === userId;
    const isNew = message.created_at > new Date(Date.now() - 5000); // Consider messages less than 5 seconds old as new
    const commonProps = { key: message.id, message, isSender, onReply, onForward, onCollect, isNew, onRecall: handleRecallMessage, onDelete: handleDeleteMessage };

    switch (message.message_type) {
      case 'text':
        return <TextMessage {...commonProps} />;
      case 'image':
        return <ImageMessage {...commonProps} />;
      case 'file':
        return <FileMessage {...commonProps} />;
      case 'voice':
        return <VoiceMessage {...commonProps} />;
      case 'video':
        return <VideoMessage {...commonProps} />;
      case 'system':
        return <SystemMessage {...commonProps} />;
      default:
        return <TextMessage {...commonProps} message={{ ...message, content: `Unsupported message type: ${message.message_type}` }} />;
    }
  };

    return (

      <div className="flex h-screen antialiased text-gray-800">

        <div className="flex flex-col md:flex-row h-full w-full overflow-x-hidden">

          {/* Sidebar: Conversations or Rooms */}

          <div className={`flex-shrink-0 ${selectedConversation || selectedChatRoom ? 'hidden md:flex' : 'flex'} flex-col py-8 pl-6 pr-2 md:w-64 bg-white border-r border-gray-200`}>

            <div className="flex items-center justify-between p-4 border-b border-gray-200">

              <h2 className="text-xl font-semibold text-gray-800">{viewMode === 'conversation' ? 'Chats' : 'Rooms'}</h2>

              <div className="flex items-center">
                <button
                  onClick={() => setShowCollectedMessages(!showCollectedMessages)}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                >
                  {showCollectedMessages ? 'Hide Collected' : 'Show Collected'}
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'conversation' ? 'rooms' : 'conversation')}
                  className="ml-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                >
                  {viewMode === 'conversation' ? 'Go Rooms' : 'Go Chats'}
                </button>
              </div>

            </div>

            {viewMode === 'conversation' ? (
              <ConversationList
                conversations={conversations}
                onSelectConversation={handleSelectConversation}
                onSearch={handleSearch}
              />
            ) : (
              <ChatRoomList chatRooms={chatRooms} onSelectChatRoom={handleSelectChatRoom} onCreateChatRoom={handleCreateChatRoom} />
            )}

          </div>



          {/* Chat Window */}

          <div className={`flex flex-col flex-auto h-full p-6 ${(selectedConversation || selectedChatRoom) ? 'flex' : 'hidden md:flex'}`}>

            {errorMessage && (

              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">

                <strong className="font-bold">Error!</strong>

                <span className="block sm:inline"> {errorMessage}</span>

                <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setErrorMessage(null)}>

                  <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.15a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.15 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>

                </span>

              </div>

            )}

            {selectedChatRoom ? (
              <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-gray-100 h-full">
                <ChatRoom selectedChatRoom={selectedChatRoom} onSendMessage={handleSendRoomMessage} onlineMembers={[]} />
              </div>
            ) : (
              <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-gray-100 h-full">
                {selectedConversation?.type === 'group' && (
                  <div className="mb-2">
                    <GroupInfo />
                  </div>
                )}
                <ChatWindow selectedConversation={selectedConversation} messages={messages} renderMessage={(message) => renderMessage(message, setReplyToMessage, handleForwardMessage, handleCollectMessage)} typingUsers={typingUsers} userId={userId} searchResults={searchResults} searchQuery={searchQuery} onReply={setReplyToMessage} onClearHistory={handleClearHistory} onLoadMoreMessages={handleLoadMoreMessages} hasMoreMessages={hasMoreMessages} isLoadingMessages={isLoadingMessages} />
                <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} onImageUpload={handleImageUpload} onFileUpload={handleFileUpload} onVoiceRecord={handleVoiceRecord} onVideoUpload={handleVideoUpload} replyToMessage={replyToMessage} setReplyToMessage={setReplyToMessage} />
              </div>
            )}

          </div>



          {showCollectedMessages && (

            <CollectedMessagesSidebar

              collectedMessages={collectedMessages}

              onClose={() => setShowCollectedMessages(false)}

              onUncollectMessage={handleUncollectMessage}

              userId={userId}

            />

          )}

        </div>

      </div>

    );

  };

export default ChatPage;
