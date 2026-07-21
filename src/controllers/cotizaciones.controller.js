const {
  getAllDolar,
  getDolarByTipo,
} = require('../services/dolarApi.service');
const { getBnaEuro } = require('../services/bna.service');

/**
 * GET /api/cotizaciones
 * Devuelve dólar (todos los tipos) y euro BNA en paralelo.
 */
async function getAllCotizaciones(req, res) {
  try {
    const [dolarResult, euroBnaResult] =
      await Promise.allSettled([getAllDolar(), getBnaEuro()]);

    const dolar =
      dolarResult.status === 'fulfilled' ? dolarResult.value : [];

    const euro = [];
    if (euroBnaResult.status === 'fulfilled') {
      euro.push(...euroBnaResult.value);
    }

    res.json({
      dolar,
      euro,
      fechaConsulta: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/cotizaciones/dolar
 */
async function getDolar(req, res) {
  try {
    const data = await getAllDolar();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/cotizaciones/dolar/:tipo
 */
async function getDolarByTipoHandler(req, res) {
  try {
    const { tipo } = req.params;
    const data = await getDolarByTipo(tipo);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/cotizaciones/euro
 * Devuelve cotizaciones de euro desde BNA (Puppeteer).
 */
async function getEuro(req, res) {
  try {
    const resultado = await getBnaEuro();

    if (resultado.length === 0) {
      return res
        .status(500)
        .json({ error: 'No se pudieron obtener cotizaciones de euro' });
    }

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllCotizaciones,
  getDolar,
  getDolarByTipo: getDolarByTipoHandler,
  getEuro,
};
