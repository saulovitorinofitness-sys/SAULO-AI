export interface NormalizedFoodGroup {
  readonly id: string;
  readonly label: string;
  readonly originalLabel: string;
  readonly mapping: "EXPLICIT_EQUIVALENCE" | "ORIGINAL_CLASSIFICATION";
}

const normalizeExactLabel = (value: string) => value
  .trim()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR");

const explicitGroupMappings = [
  {
    id: "CEREALS_AND_DERIVATIVES",
    label: "Cereais e derivados",
    aliases: ["Cereais", "Cereais e derivados"],
  },
  {
    id: "VEGETABLES_AND_GREENS",
    label: "Verduras, hortaliças e legumes",
    aliases: [
      "Verduras e hortaliças",
      "Verduras e legumes",
      "Verduras, hortaliças e legumes",
    ],
  },
] as const;

const explicitGroupByLabel = new Map(
  explicitGroupMappings.flatMap((group) =>
    group.aliases.map((alias) => [normalizeExactLabel(alias), group] as const),
  ),
);

/**
 * Consolida somente equivalências enumeradas. Qualquer outra classificação
 * mantém rótulo e identificador próprios, mesmo que o texto pareça semelhante.
 */
export function normalizeFoodGroup(originalValue: string): NormalizedFoodGroup {
  const originalLabel = originalValue.trim() || "Sem grupo informado";
  const exactKey = normalizeExactLabel(originalLabel);
  const mapped = explicitGroupByLabel.get(exactKey);
  if (mapped) {
    return {
      id: mapped.id,
      label: mapped.label,
      originalLabel,
      mapping: "EXPLICIT_EQUIVALENCE",
    };
  }
  return {
    id: `ORIGINAL:${exactKey || "SEM_GRUPO"}`,
    label: originalLabel,
    originalLabel,
    mapping: "ORIGINAL_CLASSIFICATION",
  };
}
