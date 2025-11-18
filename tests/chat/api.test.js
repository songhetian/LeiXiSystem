const axios = require('axios')

async function run() {
  const base = 'http://localhost:3001/api/chat'
  const userId = 1

  try {
    const convRes = await axios.get(`${base}/conversations`, { params: { userId } })
    console.log('Conversations count:', Array.isArray(convRes.data.data) ? convRes.data.data.length : 0)

    if (convRes.data.data && convRes.data.data.length > 0) {
      const convId = convRes.data.data[0].id
      const msgRes = await axios.get(`${base}/conversations/${convId}/messages`, { params: { limit: 20, offset: 0 } })
      console.log('Messages fetched:', Array.isArray(msgRes.data.data) ? msgRes.data.data.length : 0)

      // Search
      const searchRes = await axios.get(`${base}/messages/search`, { params: { query: '测试', conversationId: convId } })
      console.log('Search results:', Array.isArray(searchRes.data.data) ? searchRes.data.data.length : 0)
    }

    // Collected messages
    const collectedRes = await axios.get(`${base}/collected-messages`, { params: { userId } })
    console.log('Collected messages:', Array.isArray(collectedRes.data.data) ? collectedRes.data.data.length : 0)
  } catch (err) {
    console.error('Chat API test failed:', err.response?.data || err.message)
  }
}

run()