const puppeteer = require('puppeteer');
const cache = require('../config/cache');
const { limitarADosDecimales } = require('../utils/cotizaciones');

const BNA_URL = 'https://www.bna.com.ar/Personas';
const CURRENCIES = {
  EUR: { cacheKey: 'euro:bna', name: 'Euro', pattern: 'euro' },
  USD: {
    cacheKey: 'dolar:bna',
    name: 'Dolar',
    pattern: 'd[oó]lar(?:\\s+u\\.?s\\.?a\\.?)?',
  },
};

let scrapePromise;

/**
 * Parsea un string de precio argentino al formato numérico.
 * Ej: "1.635,00" → 1635
 */
function parsePrecio(text) {
  const s = text.trim();
  // Argentine format: comma is decimal separator, dots are thousands separators
  if (s.includes(',')) {
    const parsed = parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    return limitarADosDecimales(parsed);
  }
  // US/standard format: dot is decimal separator — parse directly
  return limitarADosDecimales(parseFloat(s) || 0);
}

/**
 * Scraping de cotizaciones de BNA en una sola sesión de navegador.
 */
async function scrapeBna() {
  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.goto(BNA_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Intentamos esperar el selector principal; si falla, continuamos igual
    try {
      await page.waitForSelector('#billetes, .cotizacion', { timeout: 15000 });
    } catch (_) {
      try {
        await page.waitForSelector('table', { timeout: 5000 });
      } catch (__) {
        // seguimos de todas formas — extraemos lo que haya
      }
    }

    const resultado = await page.evaluate((currencies) => {
      /**
       * Busca filas de las monedas solicitadas priorizando
       * #billetes y #divisas, con fallback a cualquier tabla.
       */
      function extraerFilas(tableSelector, pattern) {
        const table = document.querySelector(tableSelector);
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('tr'));
        const matcher = new RegExp(pattern, 'i');
        return rows.filter((row) =>
          matcher.test(row.innerText || row.textContent)
        );
      }

      function parsearFila(row) {
        const celdas = Array.from(row.querySelectorAll('td')).map(
          (td) => (td.innerText || td.textContent || '').trim()
        );
        return celdas;
      }

      const items = [];

      const procesarFila = (fila, tipoDefault, monedaCodigo) => {
        const celdas = parsearFila(fila);
        // BNA: [Moneda, Compra, Venta] (a veces más columnas)
        if (celdas.length < 3) return;
        const moneda = celdas[0];
        const compraStr = celdas[1];
        const ventaStr = celdas[2];

        // Determinamos el tipo según el texto de la celda moneda
        let tipo = tipoDefault;
        if (/billete/i.test(moneda)) tipo = 'billete';
        else if (/divisa/i.test(moneda)) tipo = 'divisa';

        items.push({ tipo, moneda: monedaCodigo, compraStr, ventaStr });
      };

      currencies.forEach(({ code, pattern }) => {
        const filasBilletes = extraerFilas('#billetes', pattern);
        const filasDivisas = extraerFilas('#divisas', pattern);

        filasBilletes.forEach((f) => procesarFila(f, 'billete', code));
        filasDivisas.forEach((f) => procesarFila(f, 'divisa', code));

        if (filasBilletes.length === 0 && filasDivisas.length === 0) {
          const matcher = new RegExp(pattern, 'i');
          const tablas = Array.from(
            document.querySelectorAll('table.table, table')
          );
          for (const tabla of tablas) {
            const filas = Array.from(tabla.querySelectorAll('tr')).filter((r) =>
              matcher.test(r.innerText || r.textContent)
            );
            const tableText = `${tabla.id || ''} ${tabla.className || ''}`;
            const tipo = /divisa/i.test(tableText) ? 'divisa' : 'billete';
            filas.forEach((f) => procesarFila(f, tipo, code));
          }
        }
      });

      return items;
    }, Object.entries(CURRENCIES).map(([code, { pattern }]) => ({ code, pattern })));

    if (resultado.length === 0) {
      throw new Error('No se encontraron cotizaciones en BNA');
    }

    const fechaActualizacion = new Date().toISOString();
    const cotizaciones = resultado.map((item) => ({
      tipo: item.tipo,
      moneda: item.moneda,
      compra: parsePrecio(item.compraStr),
      venta: parsePrecio(item.ventaStr),
      fuente: 'BNA',
      fechaActualizacion,
    }));

    const ttl = parseInt(process.env.CACHE_TTL, 10) || 300;
    Object.entries(CURRENCIES).forEach(([moneda, { cacheKey }]) => {
      const items = cotizaciones.filter((item) => item.moneda === moneda);
      if (items.length > 0) cache.set(cacheKey, items, ttl);
    });
  } catch (err) {
    throw new Error(`Error en scraping BNA: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function getBnaCurrency(moneda) {
  const config = CURRENCIES[moneda];
  const cached = cache.get(config.cacheKey);
  if (cached !== undefined) return cached;

  if (!scrapePromise) {
    scrapePromise = scrapeBna().finally(() => {
      scrapePromise = undefined;
    });
  }
  await scrapePromise;

  const cotizaciones = cache.get(config.cacheKey);
  if (cotizaciones === undefined) {
    throw new Error(
      `Error en scraping BNA: No se encontraron cotizaciones de ${config.name}`
    );
  }
  return cotizaciones;
}

function getBnaEuro() {
  return getBnaCurrency('EUR');
}

function getBnaDollar() {
  return getBnaCurrency('USD');
}

module.exports = { getBnaEuro, getBnaDollar };
