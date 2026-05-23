require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const canalesRouter = require('./routes/canales');
const messagesRouter = require('./routes/messages');
const worldRouter = require('./routes/world');
const { setupSocketHandler } = require('./socket/handler');
const { startTopTenBroadcast } = require('./socket/topten');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Rutas REST
app.use('/api/canales', canalesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/world', worldRouter);

// Health check para Railway/Render
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// WebSockets
setupSocketHandler(io);
startTopTenBroadcast(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[WATP] Server running on port ${PORT}`);
});
