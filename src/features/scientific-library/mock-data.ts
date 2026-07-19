import type { ScientificLibraryDomain, ScientificLibraryItem } from "./contracts";

const reviewedAt = "2026-07-16T17:40:00-03:00";
const reviewedBy = "Saulo Xavier Vitorino";

function item(input: { id: string; domain: ScientificLibraryDomain; name: string; category: string; description: string; source?: string; tags?: readonly string[]; attributes?: Readonly<Record<string, string | readonly string[]>>; reusableBy?: readonly string[]; favorite?: boolean }): ScientificLibraryItem {
  return { ...input, source: input.source ?? "Cadastro científico demonstrativo", tags: input.tags ?? ["mock", "revisão profissional"], attributes: input.attributes ?? {}, reusableBy: input.reusableBy ?? ["Módulos autorizados do SAULO AI"], reviewedAt, reviewedBy, initiallyFavorite: input.favorite ?? false };
}

const fromNames = (domain: ScientificLibraryDomain, category: string, names: readonly string[], description: string, reusableBy: readonly string[]) => names.map((name, index) => item({ id: `${domain.toLowerCase()}-${index + 1}`, domain, name, category, description, reusableBy, favorite: index === 0 }));

const dataSources = ["TACO", "TBCA", "IBGE", "USDA", "Outras fontes"] as const;
const equations = ["Harris-Benedict", "Mifflin", "Owen", "Schofield", "Henry"] as const;
const activityFactors = ["Sedentário", "Levemente ativo", "Moderadamente ativo", "Muito ativo", "Extremamente ativo", "Personalizado"] as const;
const injuryFactors = ["Trauma", "Queimaduras", "Infecção", "Pós-operatório", "Oncologia", "UTI", "Outros"] as const;
const pathologies = ["Obesidade", "Diabetes", "HAS", "Dislipidemia", "MASLD", "SOP", "DRC", "Hipotireoidismo", "Hipertireoidismo", "Outras"] as const;
const strengthMethods = ["Pirâmide", "Drop-set", "Rest-pause", "Bi-set", "Tri-set", "FST-7", "SST", "Circuito", "Pré-exaustão", "Pós-exaustão", "Super-série"] as const;
const enduranceMethods = ["Contínuo", "Intervalado", "Fartlek", "Tempo", "Longão", "Recuperativo", "Subida", "VO₂", "Limiar", "Sweet Spot"] as const;
const assessments = ["Cooper", "Rockport", "Bruce", "Banco de Wells", "Sit and Reach", "Teste de Sentar e Alcançar", "Dedo-Solo", "Outros"] as const;
const posturalChanges = ["Hipercifose", "Hiperlordose", "Escoliose", "Escápula alada", "Protração dos ombros", "Geno valgo", "Geno varo", "Pé plano", "Pé cavo"] as const;

export const complementaryScientificItems: readonly ScientificLibraryItem[] = [
  ...dataSources.map((name, index) => item({ id: `data-source-${index + 1}`, domain: "DATA_SOURCE", name, category: "Base de composição e referência", description: "Fonte estruturada para identificação da origem dos registros. Conteúdo demonstrativo.", attributes: { cobertura: "Metadado demonstrativo", status: "Disponível para catalogação" }, reusableBy: ["Alimentos", "Exames", "Protocolos"], favorite: index < 2 })),
  ...equations.map((name, index) => item({ id: `equation-${index + 1}`, domain: "EQUATION", name, category: "Equação registrada", description: "Estrutura de referência sem cálculo implementado.", attributes: { fórmula: "Não executada nesta Sprint", validação: "Necessita decisão profissional" }, reusableBy: ["Avaliação nutricional futura"], favorite: index === 1 })),
  ...fromNames("ACTIVITY_FACTOR", "Nível de atividade", activityFactors, "Fator catalogado sem valor ou cálculo aplicado.", ["Avaliação nutricional futura", "Performance"]),
  ...fromNames("INJURY_FACTOR", "Contexto clínico", injuryFactors, "Estrutura catalogada sem fator numérico ou aplicação clínica.", ["Avaliação clínica futura"]),
  ...pathologies.map((name, index) => item({ id: `pathology-${index + 1}`, domain: "PATHOLOGY", name, category: "Condição catalogada", description: "Entrada organizacional sem protocolo, diagnóstico ou conduta automática.", attributes: { protocoloAutomático: "Não disponível", confirmação: "Exclusivamente profissional" }, reusableBy: ["Anamnese", "Motor de Decisão Assistido"], favorite: index === 0 })),
  ...strengthMethods.map((name, index) => item({ id: `training-strength-${index + 1}`, domain: "TRAINING_METHOD", name, category: "Musculação", description: "Método de treinamento catalogado sem prescrição automática.", attributes: { modalidade: "Musculação", aplicação: "Depende de decisão profissional" }, reusableBy: ["Plano de Treino futuro"] })),
  ...enduranceMethods.map((name, index) => item({ id: `training-endurance-${index + 1}`, domain: "TRAINING_METHOD", name, category: "Endurance", description: "Método de endurance catalogado sem prescrição automática.", attributes: { modalidade: "Endurance", aplicação: "Depende de decisão profissional" }, reusableBy: ["Performance Endurance", "Plano de Treino futuro"], favorite: index === 1 })),
  ...fromNames("ASSESSMENT", "Teste de avaliação", assessments, "Avaliação catalogada sem protocolo de cálculo ou classificação.", ["Avaliação Física"]),
  ...posturalChanges.map((name, index) => item({ id: `postural-change-${index + 1}`, domain: "POSTURAL_CHANGE", name, category: "Achado postural estruturado", description: "Termo catalogado para registro profissional, sem análise de imagem ou diagnóstico automático.", attributes: { confirmação: "Necessita avaliação profissional" }, reusableBy: ["Avaliação Postural"], favorite: index === 0 })),
];

