const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pool = require('../db');

// GET /api/contenido/me — contenido del usuario autenticado
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM contenido WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.sub]
    );
    res.json(rows);
  } catch (e) {
    console.error('[contenido GET /me]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/contenido/user/:username — contenido público de un usuario
router.get('/user/:username', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ct.* FROM contenido ct
       JOIN profiles p ON p.id = ct.owner_id
       WHERE p.username = $1 AND ct.is_public = true
       ORDER BY ct.created_at DESC`,
      [req.params.username.toLowerCase()]
    );
    res.json(rows);
  } catch (e) {
    console.error('[contenido GET /user/:username]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
