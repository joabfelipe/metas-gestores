/**
 * Extrai { year, month } de req.query.
 * Aceita ?period=2026-03 ou ?year=2026&month=3.
 * Usa a data atual como fallback.
 */
function parsePeriod(query) {
  const now = new Date();

  if (query.period) {
    const [year, month] = query.period.split("-").map(Number);
    return { year, month };
  }

  return {
    year: Number(query.year || now.getFullYear()),
    month: Number(query.month || now.getMonth() + 1),
  };
}

module.exports = parsePeriod;
