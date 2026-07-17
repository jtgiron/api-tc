const { Router } = require('express');
const {
  getAllCotizaciones,
  getDolar,
  getDolarByTipo,
  getEuro,
} = require('../controllers/cotizaciones.controller');

const router = Router();

router.get('/', getAllCotizaciones);
router.get('/dolar', getDolar);
router.get('/dolar/:tipo', getDolarByTipo);
router.get('/euro', getEuro);

module.exports = router;
