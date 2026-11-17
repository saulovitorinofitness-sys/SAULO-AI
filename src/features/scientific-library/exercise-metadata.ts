import type { ScientificLibraryDraft } from "./management-contracts";

export const EXERCISE_MODALITIES = [
  "Musculação",
  "Peso corporal",
  "Treinamento funcional",
  "Corrida",
  "Ciclismo",
  "Mobilidade",
  "Flexibilidade",
  "Alongamento",
  "Exercício corretivo",
  "Core",
  "Cardiorrespiratório",
  "Educativo/técnico",
  "Outro",
] as const;

export const EXERCISE_MOVEMENT_PATTERNS = [
  "Agachar", "Empurrar horizontal", "Empurrar vertical", "Puxar horizontal",
  "Puxar vertical", "Hinge / dobradiça de quadril", "Avanço / passada",
  "Extensão de joelho", "Flexão de joelho", "Extensão de quadril",
  "Abdução de quadril", "Adução de quadril", "Flexão de cotovelo",
  "Extensão de cotovelo", "Elevação/abdução de ombro", "Rotação de ombro",
  "Core anti-extensão", "Core anti-rotação", "Core anti-flexão lateral",
  "Flexão de tronco", "Extensão de tronco", "Locomoção", "Mobilidade",
  "Alongamento", "Cardiovascular", "Outro",
] as const;

export const EXERCISE_CLASSIFICATIONS = [
  "Multiarticular", "Monoarticular", "Isométrico", "Dinâmico", "Mobilidade",
  "Alongamento", "Cardiorrespiratório", "Educativo/técnico", "Corretivo", "Outro",
] as const;

export const EXERCISE_DIFFICULTIES = [
  "Iniciante", "Intermediário", "Avançado", "Adaptável a todos",
] as const;

export const EXERCISE_OBJECTIVES = [
  "Força", "Hipertrofia", "Resistência muscular", "Potência", "Mobilidade",
  "Flexibilidade", "Estabilidade", "Coordenação", "Técnica",
  "Condicionamento cardiorrespiratório", "Prevenção de lesões",
  "Reabilitação funcional dentro do escopo profissional", "Exercício corretivo",
  "Aquecimento", "Recuperação", "Outro",
] as const;

export const EXERCISE_BODY_REGIONS = [
  "Corpo inteiro", "Peitoral", "Costas", "Ombros", "Bíceps", "Tríceps",
  "Antebraços", "Core", "Quadríceps", "Posterior de coxa", "Glúteos",
  "Adutores", "Abdutores", "Panturrilhas", "Coluna/tronco", "Quadril",
  "Joelho", "Tornozelo/pé", "Membros superiores", "Membros inferiores",
  "Cardiovascular", "Outra região",
] as const;

export const EXERCISE_EQUIPMENT = [
  "Peso corporal", "Barra", "Halteres", "Anilhas", "Kettlebell", "Máquina",
  "Cabo/polia", "Smith", "Leg press", "Banco", "Elástico", "TRX/suspensão",
  "Bola", "Bosu", "Caixa/step", "Bicicleta", "Esteira", "Ergômetro", "Outro",
] as const;

export function normalizeExerciseAttributes(
  attributes: Readonly<Record<string, string | readonly string[]>>,
) {
  const next = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  ) as ScientificLibraryDraft["attributes"];
  const legacyRegion = next["Grupo muscular ou região"] ?? next["Grupo muscular / região"];
  const legacyEquipment = next.Equipamento;
  const legacyExecution = next.Execução ?? next["Descrição de execução"];

  if (!next["Grupos musculares / regiões"] && typeof legacyRegion === "string") {
    next["Grupos musculares / regiões"] = legacyRegion ? [legacyRegion] : [];
  }
  if (!next.Equipamentos && typeof legacyEquipment === "string") {
    next.Equipamentos = legacyEquipment ? [legacyEquipment] : [];
  }
  if (!next["Execução técnica"] && typeof legacyExecution === "string") {
    next["Execução técnica"] = legacyExecution;
  }
  delete next["Grupo muscular ou região"];
  delete next["Grupo muscular / região"];
  delete next.Equipamento;
  delete next.Execução;
  delete next["Descrição de execução"];
  return next;
}
