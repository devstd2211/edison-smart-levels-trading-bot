export function hasValidPositiveDenominator(
  numerator: number,
  denominator: number,
): boolean {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0;
}

export function safeRatio(numerator: number, denominator: number): number | null {
  if (!hasValidPositiveDenominator(numerator, denominator)) {
    return null;
  }
  const ratio = numerator / denominator;
  return Number.isFinite(ratio) ? ratio : null;
}
