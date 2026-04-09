// Função: calcular distância entre dois endereços usando Google Maps API ou fallback
// Rota: POST /utils/calculate-distance

const express = require('express');
const router = express.Router();
// Middleware de autenticação JWT
const { authMiddleware } = require('./auth');

// POST /utils/calculate-distance
router.post('/calculate-distance', authMiddleware, async (req, res, next) => {
  try {
    const { manualDistance } = req.body;

    // Apenas distância manual é suportada conforme solicitado
    if (manualDistance !== undefined && manualDistance !== null) {
      return res.json({
        distance_km: parseFloat(manualDistance),
        is_manual: true
      });
    }

    return res.json({
      distance_km: null,
      is_manual: false,
      message: 'Por favor, insira a distância manualmente.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
