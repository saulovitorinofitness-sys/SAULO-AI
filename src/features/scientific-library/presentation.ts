export type ScientificAttributeValue =
  | string
  | number
  | boolean
  | null
  | readonly ScientificAttributeValue[]
  | { readonly [key: string]: ScientificAttributeValue };

function isStructuredValue(value: unknown): value is ScientificAttributeValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isStructuredValue);
  return (
    typeof value === "object" &&
    Object.values(value).every(isStructuredValue)
  );
}

export function parseScientificAttributeValue(
  value: string | readonly string[],
): ScientificAttributeValue {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text.startsWith("[") && !text.startsWith("{")) return value;
  try {
    const parsed: unknown = JSON.parse(text);
    return isStructuredValue(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

const attributeLabels: Readonly<Record<string, string>> = {
  id: "Identificador",
  measureTypeId: "Tipo de medida",
  name: "Nome",
  equivalentAmount: "Quantidade equivalente",
  unit: "Unidade",
  demonstrative: "Dado demonstrativo",
  officialSource: "Fonte oficial",
};

export function scientificAttributeLabel(key: string) {
  return (
    attributeLabels[key] ??
    key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"))
  );
}
