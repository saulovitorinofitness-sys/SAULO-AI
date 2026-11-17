export interface ProfessionalServiceFinancialEntryDescriptionInput {
  readonly serviceDescriptions: readonly (string | null | undefined)[];
  readonly customerName: string | null | undefined;
  readonly providerName: string | null | undefined;
}

const lowercaseConnectors = new Set(["a", "as", "da", "das", "de", "do", "dos", "e", "em"]);
const protectedAcronyms = new Set(["CPF", "CREF", "CRN", "CEP", "PIX"]);

function partyName(value: string): string {
  let index = 0;
  return value.trim().replace(/\p{L}+/gu, (word) => {
    const upper = word.toLocaleUpperCase("pt-BR");
    const lower = word.toLocaleLowerCase("pt-BR");
    const first = index++ === 0;
    if (protectedAcronyms.has(upper)) return upper;
    if (!first && lowercaseConnectors.has(lower)) return lower;
    return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
  });
}

export function buildProfessionalServiceFinancialEntryDescription(
  input: ProfessionalServiceFinancialEntryDescriptionInput,
): string {
  const services = [...new Set(input.serviceDescriptions.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  const service = services.length ? services.join(" + ") : "Serviço profissional";
  const customer = input.customerName?.trim() ? partyName(input.customerName) : "Cliente não identificado";
  const provider = input.providerName?.trim() ? partyName(input.providerName) : "Prestador não identificado";
  return `${service} — ${customer} — ${provider}`;
}
