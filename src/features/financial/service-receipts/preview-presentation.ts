const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function underThousand(value: number): string {
  if (value === 100) return "cem";
  const parts: string[] = [];
  const hundred = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundred) parts.push(hundreds[hundred]!);
  if (remainder >= 10 && remainder < 20) parts.push(teens[remainder - 10]!);
  else {
    const ten = Math.floor(remainder / 10);
    const unit = remainder % 10;
    if (ten) parts.push(tens[ten]!);
    if (unit) parts.push(units[unit]!);
  }
  return parts.join(" e ");
}

function integerInWords(value: number): string {
  if (value === 0) return "zero";
  const parts: string[] = [];
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const remainder = value % 1_000;
  if (millions) parts.push(millions === 1 ? "um milhão" : `${underThousand(millions)} milhões`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${underThousand(thousands)} mil`);
  if (remainder) parts.push(underThousand(remainder));
  return parts.join(remainder > 0 && remainder < 100 ? " e " : ", ");
}

export function brlAmountInWords(value: string): string {
  const centsValue = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(centsValue) || centsValue < 0) return "valor indisponível";
  const reais = Math.floor(centsValue / 100);
  const cents = centsValue % 100;
  const realText = `${integerInWords(reais)} ${reais === 1 ? "real" : "reais"}`;
  return cents ? `${realText} e ${integerInWords(cents)} ${cents === 1 ? "centavo" : "centavos"}` : realText;
}

const lowercaseConnectors = new Set(["a", "as", "da", "das", "de", "do", "dos", "e", "em", "via"]);
const protectedAcronyms = new Set(["CPF", "CREF", "CRN", "CEP", "PIX"]);
const brazilianStates = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function presentationTitleCase(value: string): string {
  let wordIndex = 0;
  return value.trim().replace(/\p{L}+/gu, (word) => {
    const upper = word.toLocaleUpperCase("pt-BR");
    const lower = word.toLocaleLowerCase("pt-BR");
    const isFirst = wordIndex++ === 0;
    if (protectedAcronyms.has(upper) || brazilianStates.has(upper)) return upper;
    if (!isFirst && lowercaseConnectors.has(lower)) return lower;
    return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
  });
}

export function professionalRegistrationLabel(registration: {
  readonly council: "CRN" | "CREF";
  readonly number: string | null;
  readonly category: string | null;
  readonly state: string | null;
}): string {
  const number = registration.number?.trim();
  const category = registration.category?.trim().toLocaleUpperCase("pt-BR");
  const state = registration.state?.trim().toLocaleUpperCase("pt-BR");
  if (!number || !category || !state) return `${registration.council} incompleto`;
  const categorizedNumber = number.toLocaleUpperCase("pt-BR").endsWith(`-${category}`)
    ? number
    : `${number}-${category}`;
  return `${registration.council} ${categorizedNumber}/${state}`;
}
