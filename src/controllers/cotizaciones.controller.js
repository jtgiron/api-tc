const {
  getAllDolar,
  getDolarByTipo,
  getEuroOficial,
} = require('../services/dolarApi.service');
const { getBnaEuro } = require('../services/bna.service');

/**
 * GET /api/cotizaciones
 * Devuelve dólar (todos los tipos), euro oficial y euro BNA en paralelo.
 */
async function getAllCotizaciones(req, res) {
  try {
    const [dolarResult, euroOficialResult, euroBnaResult] =
      await Promise.allSettled([getAllDolar(), getEuroOficial(), getBnaEuro()]);

    const dolar =
      dolarResult.status === 'fulfilled' ? dolarResult.value : [];
    
    const euro = [];
    if (euroOficialResult.status === 'fulfilled') {
      euro.push(euroOficialResult.value);
    }
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
 * Combina BNA (Puppeteer) + euro oficial de dolarapi en paralelo.
 */
async function getEuro(req, res) {
  try {
    const [bnaResult, oficialResult] = await Promise.allSettled([
      getBnaEuro(),
      getEuroOficial(),
    ]);

    const resultado = [];
    if (bnaResult.status === 'fulfilled') {
      resultado.push(...bnaResult.value);
    }
    if (oficialResult.status === 'fulfilled') {
      resultado.push(oficialResult.value);
    }

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
