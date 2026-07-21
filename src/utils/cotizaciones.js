function limitarADosDecimales(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return valor;

  return Math.trunc(valor * 100) / 100;
}

function normalizarValoresCotizacion(cotizacion) {
  if (Array.isArray(cotizacion)) {
    return cotizacion.map(normalizarValoresCotizacion);
  }

  if (!cotizacion || typeof cotizacion !== 'object') return cotizacion;

  return Object.fromEntries(
    Object.entries(cotizacion).map(([clave, valor]) => [
      clave,
      clave === 'compra' || clave === 'venta'
        ? limitarADosDecimales(valor)
        : valor,
    ])
  );
}

module.exports = { limitarADosDecimales, normalizarValoresCotizacion };
