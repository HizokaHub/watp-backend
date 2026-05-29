const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pool = require('../db');

// GET /api/comunidades/me — comunidades que sigue el usuario autenticado
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.* FROM comunidades c
       JOIN comunidad_members cm ON cm.comunidad_id = c.id
       WHERE cm.user_id = $1
       ORDER BY cm.joined_at DESC`,
      [req.user.sub]
    );
    res.json(rows);
  } catch (e) {
    console.error('[comunidades GET /me]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/comunidades — todas las comunidades (explorar)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM comunidades ORDER BY members_count DESC, nivel ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error('[comunidades GET /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
