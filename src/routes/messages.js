const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// GET /api/messages/global — últimos 50 mensajes globales
router.get('/global', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM global_messages
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json(rows.reverse()); // del más antiguo al más nuevo
  } catch (e) {
    console.error('[messages GET /global]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/canal/:id — últimos 50 mensajes de un canal
router.get('/canal/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM canal_messages
       WHERE canal_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    res.json(rows.reverse()); // del más antiguo al más nuevo
  } catch (e) {
    console.error('[messages GET /canal/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
