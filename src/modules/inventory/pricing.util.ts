export function calculateSellPrice(avgCost?: number, markupPercent?: number) {
  if (typeof avgCost !== 'number' || Number.isNaN(avgCost)) {
    return undefined;
  }
  if (typeof markupPercent !== 'number' || Number.isNaN(markupPercent)) {
    return undefined;
  }
  const price = avgCost * (1 + markupPercent / 100);
  return Number(price.toFixed(2));
}

