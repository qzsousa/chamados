import express from 'express'

const app = express()

app.get('/test', (req, res) => res.json({ok: true}))

const server = app.listen(3004, '0.0.0.0', () => {
  console.log('Server running on port 3004')
})

server.on('listening', () => {
  console.log('LISTENING event fired')
})

server.on('error', (e) => {
  console.error('ERROR:', e)
})

console.log('After listen call, waiting...')

// Keep alive
setInterval(() => {}, 1000)