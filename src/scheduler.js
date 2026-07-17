const { getAllDolar, getEuroOficial } = require('./services/dolarApi.service');
const { getBnaEuro } = require('./services/bna.service');

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function refreshAll() {
  const timestamp = new Date().toISOString();
  console.log(`[scheduler] Refreshing cotizaciones at ${timestamp}...`);

  const results = await Promise.allSettled([
    getAllDolar(),
    getEuroOficial(),
    getBnaEuro(),
  ]);

  const labels = ['dolar:all', 'euro:oficial', 'euro:bna'];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[scheduler] ✓ ${labels[i]}`);
    } else {
      console.error(`[scheduler] ✗ ${labels[i]} — ${r.reason?.message}`);
    }
  });
}

function start() {
  // Warm cache immediately on startup
  refreshAll();
  // Then refresh every 30 minutes
  setInterval(refreshAll, INTERVAL_MS);
  console.log(`[scheduler] Started — refresh every ${INTERVAL_MS / 60000} minutes`);
}

module.exports = { start };
