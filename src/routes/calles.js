const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pool = require('../db');

// GET /api/calles/me — mi calle
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM calles WHERE user_id = $1',
      [req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Calle no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[calles GET /me]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/calles/me/world — actualizar world_data de mi calle
router.put('/me/world', verifyToken, async (req, res) => {
  const { world_data } = req.body;
  if (!world_data || typeof world_data !== 'object') {
    return res.status(400).json({ error: 'world_data debe ser un objeto JSON' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE calles SET world_data = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [JSON.stringify(world_data), req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Calle no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[calles PUT /me/world]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calles/:username — calle pública de un usuario
router.get('/:username', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.* FROM calles c
       JOIN profiles p ON p.id = c.user_id
       WHERE c.username = $1 AND c.is_public = true AND p.is_public = true`,
      [req.params.username.toLowerCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Calle no encontrada' });

    await pool.query(
      'UPDATE calles SET visits_count = visits_count + 1 WHERE id = $1',
      [rows[0].id]
    );

    res.json(rows[0]);
  } catch (e) {
    console.error('[calles GET /:username]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
