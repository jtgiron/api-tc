const axios = require('axios');
const cache = require('../config/cache');

const BASE_URL = 'https://dolarapi.com/v1';

/**
 * GET /dolares — todos los tipos de dólar
 */
async function getAllDolar() {
  const cacheKey = 'dolar:all';
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/dolares`);
    cache.set(cacheKey, data);
    return data;
  } catch (err) {
    throw new Error(`Error al obtener todos los tipos de dólar: ${err.message}`);
  }
}

/**
 * GET /dolares/:tipo — dólar por tipo (oficial, blue, bolsa, etc.)
 */
async function getDolarByTipo(tipo) {
  const cacheKey = `dolar:${tipo}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/dolares/${tipo}`);
    cache.set(cacheKey, data);
    return data;
  } catch (err) {
    throw new Error(`Error al obtener dólar tipo "${tipo}": ${err.message}`);
  }
}

/**
 * GET /cotizaciones/eur — euro oficial
 */
async function getEuroOficial() {
  const cacheKey = 'euro:oficial';
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/cotizaciones/eur`);
    cache.set(cacheKey, data);
    return data;
  } catch (err) {
    throw new Error(`Error al obtener euro oficial: ${err.message}`);
  }
}

module.exports = { getAllDolar, getDolarByTipo, getEuroOficial };
