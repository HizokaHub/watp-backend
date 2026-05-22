const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { getKey } = require('../utils/jwks');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Map en memoria: canalId (string) -> Set de socketIds (string)
// Esto nos da O(1) para join/leave y conteo instantáneo sin DB
const channelUsers = new Map();

/**
 * Retorna el número de usuarios conectados en un canal.
 */
function getChannelCount(canalId) {
  if (!channelUsers.has(canalId)) return 0;
  return channelUsers.get(canalId).size;
}

/**
 * Retorna el top 10 de canales por usuarios conectados.
 * Solo incluye canales con al menos 1 usuario.
 */
function getTopTen() {
  const entries = [];
  for (const [canalId, sockets] of channelUsers.entries()) {
    if (sockets.size > 0) {
      entries.push({ canalId, count: sockets.size });
    }
  }
  entries.sort((a, b) => b.count - a.count);
  return entries.slice(0, 10);
}

function setupSocketHandler(io) {
  // Middleware de autenticación para Socket.io
  // Verifica el JWT de Supabase en el handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token de autenticación requerido'));
    }
    jwt.verify(token, getKey, { algorithms: ['ES256'] }, (err, decoded) => {
      if (err) return next(new Error('Token inválido'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[socket] Conectado: ${user.email} (${socket.id})`);

    // Todo usuario autenticado entra al room global automáticamente
    socket.join('global');

    // ─── JOIN CANAL ────────────────────────────────────────────────
    socket.on('join_channel', (canalId) => {
      if (!canalId || typeof canalId !== 'string') return;

      // Salir del canal anterior si había uno
      if (socket.currentChannel && socket.currentChannel !== canalId) {
        _leaveChannel(io, socket, socket.currentChannel);
      }

      socket.join(`canal:${canalId}`);
      if (!channelUsers.has(canalId)) channelUsers.set(canalId, new Set());
      channelUsers.get(canalId).add(socket.id);
      socket.currentChannel = canalId;

      console.log(`[socket] ${user.email} joined canal:${canalId} (${getChannelCount(canalId)} users)`);

      // Notificar a todos en el canal el nuevo conteo
      io.to(`canal:${canalId}`).emit('channel_count', {
        canalId,
        count: getChannelCount(canalId),
      });
    });

    // ─── LEAVE CANAL ───────────────────────────────────────────────
    socket.on('leave_channel', (canalId) => {
      if (!canalId) return;
      _leaveChannel(io, socket, canalId);
    });

    // ─── MENSAJE GLOBAL ────────────────────────────────────────────
    socket.on('send_global_message', async (data) => {
      if (!data || !data.message || !data.message.trim()) return;

      const message = data.message.trim().slice(0, 500);

      try {
        const { rows } = await pool.query(
          `INSERT INTO global_messages (user_id, user_email, message)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [user.sub, user.email, message]
        );
        // Emitir a todos en el room global
        io.to('global').emit('new_global_message', rows[0]);
      } catch (e) {
        console.error('[socket] send_global_message error:', e.message);
        socket.emit('error', { message: 'Error al enviar mensaje global' });
      }
    });

    // ─── MENSAJE DE CANAL ──────────────────────────────────────────
    socket.on('send_canal_message', async (data) => {
      if (!data || !data.canalId || !data.message || !data.message.trim()) return;

      // Verificar que el usuario esté en ese canal
      if (socket.currentChannel !== data.canalId) {
        socket.emit('error', { message: 'Debes unirte al canal primero' });
        return;
      }

      const message = data.message.trim().slice(0, 500);

      try {
        const { rows } = await pool.query(
          `INSERT INTO canal_messages (canal_id, user_id, user_email, message)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [data.canalId, user.sub, user.email, message]
        );
        // Emitir solo a los usuarios en ese canal
        io.to(`canal:${data.canalId}`).emit('new_canal_message', rows[0]);
      } catch (e) {
        console.error('[socket] send_canal_message error:', e.message);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // ─── DISCONNECT ────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[socket] Desconectado: ${user.email} (${reason})`);
      if (socket.currentChannel) {
        _leaveChannel(io, socket, socket.currentChannel);
      }
    });
  });

  // Exponer helpers para el broadcaster del Top 10
  io._getTopTen = getTopTen;
  io._channelUsers = channelUsers;
}

/**
 * Helper interno: saca a un socket de un canal y actualiza contadores.
 */
function _leaveChannel(io, socket, canalId) {
  socket.leave(`canal:${canalId}`);

  if (channelUsers.has(canalId)) {
    channelUsers.get(canalId).delete(socket.id);
    if (channelUsers.get(canalId).size === 0) {
      channelUsers.delete(canalId);
    }
  }

  if (socket.currentChannel === canalId) {
    socket.currentChannel = null;
  }

  console.log(`[socket] ${socket.user?.email} left canal:${canalId} (${getChannelCount(canalId)} users)`);

  io.to(`canal:${canalId}`).emit('channel_count', {
    canalId,
    count: getChannelCount(canalId),
  });
}

module.exports = { setupSocketHandler };
