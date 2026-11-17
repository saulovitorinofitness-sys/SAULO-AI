const TECHNICAL_CLINICAL_MARKERS = [
  "HOMOLOGACAO",
  "TESTE",
  "MOCK",
  "DEMONSTRACAO",
  "DEBUG",
] as const;

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Recognizes an explicit technical marker at the beginning of a clinical text.
 * Words used later in a genuine clinical sentence are intentionally preserved.
 */
export function isTechnicalClinicalText(value: string | null | undefined) {
  if (!value?.trim()) return false;
  const candidate = normalized(value).replace(/^\[\s*/, "");
  return TECHNICAL_CLINICAL_MARKERS.some(
    (marker) =>
      candidate === marker ||
      candidate.startsWith(`${marker} `) ||
      candidate.startsWith(`${marker}:`) ||
      candidate.startsWith(`${marker}]`),
  );
}

export function safeClinicalText(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && !isTechnicalClinicalText(candidate)
    ? candidate
    : undefined;
}

export function safeClinicalTexts(
  values: readonly (string | null | undefined)[],
) {
  return values
    .map(safeClinicalText)
    .filter((value): value is string => value !== undefined);
}
