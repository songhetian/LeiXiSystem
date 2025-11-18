const { io } = require('socket.io-client')

async function run() {
  const socket = io('http://localhost:3001', {
    transports: ['websocket'],
    reconnectionAttempts: 2
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
    socket.emit('user:online', 1)
    setTimeout(() => { socket.disconnect(); console.log('Socket disconnected') }, 1000)
  })

  socket.on('connect_error', (err) => {
    console.error('Socket connect error:', err.message)
  })
}

run()