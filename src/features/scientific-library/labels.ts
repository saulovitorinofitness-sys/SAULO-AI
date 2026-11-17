import type {
  ScientificLibraryArea,
  ScientificLibraryDomain,
} from "./contracts";

export const scientificLibraryDomainLabels: Readonly<Record<ScientificLibraryDomain, string>> = {
  FOOD: "Alimentos",
  RECIPE: "Receitas",
  DATA_SOURCE: "Bases de dados",
  EQUATION: "Equações",
  ACTIVITY_FACTOR: "Fatores de atividade",
  PATHOLOGY: "Patologias / condições nutricionais",
  SUPPLEMENT: "Suplementos",
  FORMULATION: "Fitoterápicos e outras formulações",
  LABORATORY_EXAM: "Exames relevantes à Nutrição",
  EXERCISE: "Exercícios",
  TRAINING_METHOD: "Métodos de treinamento",
  ASSESSMENT: "Avaliações",
  POSTURAL_CHANGE: "Achados / alterações posturais",
  POSTURAL_CONDITION: "Condições / diagnósticos associados",
  PROTOCOL: "Protocolos",
};

export function scientificLibraryDomainLabelForArea(
  area: "ALL" | ScientificLibraryArea,
  domain: ScientificLibraryDomain,
) {
  if (domain === "ASSESSMENT") {
    if (area === "NUTRITION") return "Avaliações nutricionais";
    if (area === "PERFORMANCE") return "Avaliações físicas";
    if (area === "POSTURAL") return "Avaliações posturais";
  }
  if (domain === "PROTOCOL") {
    if (area === "NUTRITION") return "Protocolos nutricionais";
    if (area === "PERFORMANCE") return "Protocolos de treinamento";
    if (area === "POSTURAL") return "Protocolos posturais";
  }
  return scientificLibraryDomainLabels[domain];
}
