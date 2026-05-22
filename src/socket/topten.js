const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Inicia el broadcast del Top 10 cada 1 segundo.
 * Enriquece los datos del conteo en memoria con nombre/descripción de la DB.
 * Usa un solo query con WHERE id IN (...) para eficiencia.
 */
function startTopTenBroadcast(io) {
  setInterval(async () => {
    if (!io._getTopTen) return;

    const topRaw = io._getTopTen(); // [{ canalId, count }]

    if (topRaw.length === 0) {
      io.emit('top10_update', []);
      return;
    }

    const ids = topRaw.map((t) => t.canalId);

    try {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await pool.query(
        `SELECT id, name, description, creator_id, chat_type
         FROM canales
         WHERE id IN (${placeholders})`,
        ids
      );

      // Mapear por id para lookup O(1)
      const canalMap = {};
      rows.forEach((r) => {
        canalMap[r.id] = r;
      });

      const top10 = topRaw.map((t) => ({
        canalId: t.canalId,
        count: t.count,
        name: canalMap[t.canalId]?.name || 'Canal desconocido',
        description: canalMap[t.canalId]?.description || '',
        chat_type: canalMap[t.canalId]?.chat_type || 'free',
        creator_id: canalMap[t.canalId]?.creator_id || null,
      }));

      io.emit('top10_update', top10);
    } catch (e) {
      console.error('[top10] broadcast error:', e.message);
    }
  }, 1000);

  console.log('[top10] Broadcaster iniciado (intervalo: 1s)');
}

module.exports = { startTopTenBroadcast };
