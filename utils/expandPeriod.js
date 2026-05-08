/**
 * Expande uma vigência (validFrom/validUntil no formato YYYY-MM) em uma lista
 * de meses { year, month } cobertos pelo período.
 *
 * Se validUntil estiver vazio, assume 12 meses a partir do validFrom.
 */
function expandPeriod(validFrom, validUntil) {
  if (!validFrom || !/^\d{4}-\d{2}$/.test(validFrom)) {
    throw new Error("validFrom deve estar no formato YYYY-MM");
  }

  const [fYear, fMonth] = validFrom.split("-").map(Number);

  let endYear, endMonth;
  if (validUntil && /^\d{4}-\d{2}$/.test(validUntil)) {
    [endYear, endMonth] = validUntil.split("-").map(Number);
  } else {
    endYear = fYear;
    endMonth = fMonth + 11;
    while (endMonth > 12) {
      endMonth -= 12;
      endYear += 1;
    }
  }

  const months = [];
  let cYear = fYear;
  let cMonth = fMonth;

  while (cYear < endYear || (cYear === endYear && cMonth <= endMonth)) {
    months.push({ year: cYear, month: cMonth });
    cMonth += 1;
    if (cMonth > 12) {
      cMonth = 1;
      cYear += 1;
    }
  }

  return months;
}

module.exports = expandPeriod;
