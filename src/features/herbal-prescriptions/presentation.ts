import type { HerbalPrescriptionContent } from "./contracts";

export function herbalPrescriptionDocumentTitle(content: HerbalPrescriptionContent) {
  const categories = new Set(content.items.map((item) => item.category));
  if (categories.size === 1 && categories.has("SUPPLEMENT")) {
    return "Prescrição de suplementação";
  }
  if (categories.size === 1 && categories.has("OTHER_FORMULATION")) {
    return "Prescrição de formulação";
  }
  if (categories.size > 1) {
    return "Prescrição de fitoterápicos e suplementação";
  }
  return "Prescrição de fitoterápicos";
}
