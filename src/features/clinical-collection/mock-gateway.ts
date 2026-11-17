import { BUILT_IN_IDS } from "@/modules/permissions";
import type { ModuleKey } from "@/modules/shared";
import type {
  AnthropometryData,
  ClinicalCollectionRecords,
  ClinicalCollectionScenarioKey,
  ClinicalCollectionView,
  ClinicalPanelView,
  CurrentAttendanceView,
  DataIntegrityIssue,
  ClinicalStepRecord,
  EditableClinicalData,
  EditableClinicalStepKey,
  PosturalAssessmentData,
  ProfessionalAudit,
} from "./contracts";
import { bioimpedanceGroups, perimetryGroups } from "./field-definitions";
import type { ClinicalCollectionGateway } from "./gateway";
import {
  CLINICAL_DEMO_ATTENDANCE_ID,
  CLINICAL_DEMO_MASTER_RECORD_ID,
  CLINICAL_DEMO_PATIENT_ID,
  clinicalCollectionMockSeeds,
  clinicalCollectionScenarios,
  mariaAudit,
  sauloAudit,
} from "./mock-data";

const mutableScenarios = new Map<ClinicalCollectionScenarioKey, ClinicalCollectionView>();
const mutablePanels = new Map<ClinicalCollectionScenarioKey, Pick<ClinicalPanelView, "confirmedAt" | "confirmedBy" | "nextModule">>();
const stepOrder: readonly EditableClinicalStepKey[] = ["ANTHROPOMETRY", "PERIMETRY", "BIOIMPEDANCE", "POSTURAL_ASSESSMENT"];

const recordKey = {
  ANTHROPOMETRY: "anthropometry",
  BIOIMPEDANCE: "bioimpedance",
  PERIMETRY: "perimetry",
  POSTURAL_ASSESSMENT: "posturalAssessment",
} as const;

const moduleByStep: Readonly<Record<EditableClinicalStepKey, ModuleKey>> = {
  ANTHROPOMETRY: "PHYSICAL_ASSESSMENT",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  PERIMETRY: "PERIMETRY",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
};

function isNutritionFlowReady(records: ClinicalCollectionRecords) {
  return [
    records.anthropometry,
    records.bioimpedance,
    records.perimetry,
  ].every((record) => record.status === "COMPLETED");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readStoredCollection(key: ClinicalCollectionScenarioKey): ClinicalCollectionView | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(`saulo-ai:clinical-collection:${key}`);
  return raw ? JSON.parse(raw) as ClinicalCollectionView : undefined;
}

function storeCollection(key: ClinicalCollectionScenarioKey, collection: ClinicalCollectionView) {
  mutableScenarios.set(key, collection);
  if (typeof window !== "undefined") window.sessionStorage.setItem(`saulo-ai:clinical-collection:${key}`, JSON.stringify(collection));
}

function readStoredPanel(key: ClinicalCollectionScenarioKey) {
  const memory = mutablePanels.get(key);
  if (memory) return memory;
  const confirmedSeed = key === "complete" || key === "previous-comparison" ? {
    confirmedAt: "2026-07-16T10:45:00-03:00",
    confirmedBy: key === "previous-comparison" ? mariaAudit : sauloAudit,
    nextModule: "Motor de Decisão Clínica" as const,
  } : {};
  if (typeof window === "undefined") return confirmedSeed;
  const raw = window.sessionStorage.getItem(`saulo-ai:clinical-panel:${key}`);
  return raw ? JSON.parse(raw) as Pick<ClinicalPanelView, "confirmedAt" | "confirmedBy" | "nextModule"> : confirmedSeed;
}

function storePanel(key: ClinicalCollectionScenarioKey, panel: Pick<ClinicalPanelView, "confirmedAt" | "confirmedBy" | "nextModule">) {
  mutablePanels.set(key, panel);
  if (typeof window !== "undefined") window.sessionStorage.setItem(`saulo-ai:clinical-panel:${key}`, JSON.stringify(panel));
}

function isMissing(value: unknown) {
  return value === undefined || value === null || value === "";
}

function missingFields(step: EditableClinicalStepKey, data: EditableClinicalData): readonly string[] {
  if (step === "ANTHROPOMETRY") {
    const values = data as AnthropometryData;
    return [values.weightKg === undefined ? "Peso" : null, values.heightCm === undefined ? "Estatura" : null].filter((item): item is string => Boolean(item));
  }
  if (step === "BIOIMPEDANCE") {
    return bioimpedanceGroups.flatMap((group) => group.fields.filter((field) => field.required && isMissing(data[field.key as keyof typeof data])).map((field) => field.label));
  }
  if (step === "PERIMETRY") {
    return perimetryGroups.flatMap((group) => group.fields.filter((field) => field.required && isMissing(data[field.key as keyof typeof data])).map((field) => field.label));
  }
  return [];
}

function hasAnyValue(data: EditableClinicalData) {
  return Object.values(data).some((value) => value !== undefined && value !== "" && (typeof value !== "object" || Object.values(value).some(Boolean)));
}

function withValidation<T extends EditableClinicalData>(step: EditableClinicalStepKey, record: ClinicalStepRecord<T>): ClinicalStepRecord<T> {
  const missing = missingFields(step, record.data);
  const status =
    step === "POSTURAL_ASSESSMENT"
      ? record.audit
        ? ((record.data as PosturalAssessmentData)
            .completionStatus ?? "COMPLETED")
        : "NOT_STARTED"
      : missing.length === 0
        ? "COMPLETED"
        : hasAnyValue(record.data)
          ? "IN_PROGRESS"
          : "NOT_STARTED";
  return { ...record, missingRequiredFields: missing, status };
}

function validateRecords(records: ClinicalCollectionRecords): ClinicalCollectionRecords {
  return {
    anthropometry: withValidation("ANTHROPOMETRY", records.anthropometry),
    bioimpedance: withValidation("BIOIMPEDANCE", records.bioimpedance),
    perimetry: withValidation("PERIMETRY", records.perimetry),
    posturalAssessment: withValidation("POSTURAL_ASSESSMENT", records.posturalAssessment),
  };
}

function buildCollection(scenario: ClinicalCollectionScenarioKey): ClinicalCollectionView {
  const seed = clone(clinicalCollectionMockSeeds[scenario]);
  const records = validateRecords(seed.records);
  const completeCount = stepOrder.filter((step) => records[recordKey[step]].status === "COMPLETED").length;
  const viewer: ProfessionalAudit = seed.viewer === "MARIA"
    ? { professionalUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes, professionalName: "Maria de Lourdes Gomes", updatedAt: "2026-07-16T10:30:00-03:00", version: 1 }
    : { professionalUserId: BUILT_IN_IDS.users.sauloXavierVitorino, professionalName: "Saulo Xavier Vitorino", updatedAt: "2026-07-16T10:30:00-03:00", version: 1 };
  return {
    patientId: CLINICAL_DEMO_PATIENT_ID,
    patientName: "Paciente de demonstração",
    patientCode: "DEMO-001",
    attendanceId: CLINICAL_DEMO_ATTENDANCE_ID,
    masterRecordId: CLINICAL_DEMO_MASTER_RECORD_ID,
    consultationType: "INITIAL",
    connectedProfessional: viewer,
    records,
    previousPerimetry: seed.previousPerimetry,
    progressPercent: completeCount * 25,
    nutritionFlowReady: isNutritionFlowReady(records),
    firstIncompleteStep: stepOrder.find((step) => records[recordKey[step]].status !== "COMPLETED") ?? "SUMMARY",
    lastSavedStep: seed.lastSavedStep,
    canRead: true,
    canEdit: true,
    completed: seed.completed ?? false,
    nextAttendanceStep: seed.completed ? "Painel Clínico Integrado" : undefined,
    scenario,
  };
}

function recompute(collection: ClinicalCollectionView): ClinicalCollectionView {
  const records = validateRecords(collection.records);
  const completeCount = stepOrder.filter((step) => records[recordKey[step]].status === "COMPLETED").length;
  return {
    ...collection,
    records,
    progressPercent: completeCount * 25,
    nutritionFlowReady: isNutritionFlowReady(records),
    firstIncompleteStep: stepOrder.find((step) => records[recordKey[step]].status !== "COMPLETED") ?? "SUMMARY",
  };
}

function getScenario(key: ClinicalCollectionScenarioKey) {
  const stored = readStoredCollection(key);
  if (stored) return clone(stored);
  const existing = mutableScenarios.get(key);
  if (existing) return clone(existing);
  const built = buildCollection(key);
  mutableScenarios.set(key, built);
  return clone(built);
}

function integrityIssues(collection: ClinicalCollectionView): readonly DataIntegrityIssue[] {
  const issues: DataIntegrityIssue[] = [];
  const records = [
    ["Antropometria", collection.records.anthropometry],
    ["Bioimpedância", collection.records.bioimpedance],
    ["Perimetria", collection.records.perimetry],
    ["Avaliação Postural", collection.records.posturalAssessment],
  ] as const;
  for (const [section, record] of records) {
    const blocksIndependentFlow = section !== "Avaliação Postural";
    if (record.status !== "COMPLETED") issues.push({ id: `${section}-step`, type: "REQUIRED_STEP_INCOMPLETE", section, message: blocksIndependentFlow ? "Etapa obrigatória incompleta." : "Módulo especializado pendente; não bloqueia o fluxo nutricional.", blocking: blocksIndependentFlow });
    if (record.missingRequiredFields.length) issues.push({ id: `${section}-values`, type: "REQUIRED_VALUE_MISSING", section, message: `${record.missingRequiredFields.length} valor(es) obrigatório(s) ausente(s): ${record.missingRequiredFields.slice(0, 3).join(", ")}.`, blocking: blocksIndependentFlow });
    if (record.status === "COMPLETED" && record.missingRequiredFields.length) issues.push({ id: `${section}-mismatch`, type: "STATUS_DATA_MISMATCH", section, message: "Status concluído diverge dos campos preenchidos.", blocking: blocksIndependentFlow });
    if (record.status === "COMPLETED" && !record.audit) issues.push({ id: `${section}-author`, type: "MISSING_AUTHOR", section, message: "Registro concluído sem autoria.", blocking: blocksIndependentFlow });
    if (record.audit && !record.audit.updatedAt) issues.push({ id: `${section}-date`, type: "MISSING_DATE", section, message: "Registro sem data de atualização.", blocking: blocksIndependentFlow });
  }
  if (collection.records.posturalAssessment.status !== "COMPLETED") issues.push({ id: "postural-required", type: "POSTURAL_ASSESSMENT_MISSING", section: "Avaliação Postural", message: "Avaliação Postural pendente; permanece disponível para conclusão independente.", blocking: false });
  if (!collection.completed) issues.push({ id: "collection-confirmation", type: "NOT_CONFIRMED", section: "Coleta", message: "Coleta ainda não foi concluída.", blocking: true });
  return issues;
}

function getPanel(collection: ClinicalCollectionView): ClinicalPanelView {
  const panelState = readStoredPanel(collection.scenario);
  const issues: readonly DataIntegrityIssue[] = panelState.confirmedAt
    ? integrityIssues(collection)
    : [...integrityIssues(collection), { id: "panel-confirmation", type: "NOT_CONFIRMED", section: "Painel Clínico", message: "Registro ainda não confirmado pelo profissional.", blocking: false }];
  const audits = [collection.records.anthropometry.audit, collection.records.bioimpedance.audit, collection.records.perimetry.audit, collection.records.posturalAssessment.audit].filter((audit): audit is ProfessionalAudit => Boolean(audit));
  const collectedAt = audits.map((audit) => audit.updatedAt).sort().at(-1);
  return {
    collection,
    patient: { fullName: collection.patientName, code: collection.patientCode, age: 34, sexLabel: "Masculino" },
    collectedAt,
    integrityIssues: issues,
    accessible: collection.completed && issues.every((issue) => !issue.blocking),
    ...panelState,
    nextModule: panelState.confirmedAt ? "Motor de Decisão Clínica" : undefined,
  };
}

function progressStep(label: string, status: CurrentAttendanceView["progress"][number]["status"], statusLabel: string) {
  return { key: label.toLocaleLowerCase("pt-BR").replace(/\s+/g, "-"), label, status, statusLabel };
}

function currentAttendance(collection: ClinicalCollectionView): CurrentAttendanceView {
  const issues = integrityIssues(collection);
  const records = [
    ["Antropometria", collection.records.anthropometry],
    ["Bioimpedância", collection.records.bioimpedance],
    ["Perimetria", collection.records.perimetry],
    ["Avaliação Postural", collection.records.posturalAssessment],
  ] as const;
  const completedLabels = records.filter(([, record]) => record.status === "COMPLETED").map(([label]) => label);
  const nextPending = records.find(([, record]) => record.status !== "COMPLETED")?.[0];
  const isNotStarted = collection.progressPercent === 0;
  const hasIntegrityPending = collection.completed && issues.some((issue) => issue.blocking);
  const isComplete = collection.completed && !hasIntegrityPending;
  const collectionHref = `/pacientes/${collection.patientId}/atendimentos/${collection.attendanceId}/coleta?scenario=${collection.scenario}`;
  const panelHref = `/pacientes/${collection.patientId}/atendimentos/${collection.attendanceId}/painel-clinico?scenario=${collection.scenario}`;
  const actions = isNotStarted
    ? [{ key: "START_COLLECTION" as const, label: "Iniciar coleta clínica", href: collectionHref, primary: true }]
    : isComplete
      ? [
          { key: "OPEN_CLINICAL_PANEL" as const, label: "Abrir Painel Clínico", href: panelHref, primary: true },
          { key: "OPEN_COLLECTION_SUMMARY" as const, label: "Abrir resumo da coleta", href: `${collectionHref}&step=SUMMARY`, primary: false },
          { key: "REVIEW_COLLECTION" as const, label: "Revisar coleta", href: `${collectionHref}&step=ANTHROPOMETRY`, primary: false },
        ]
      : [
          { key: "CONTINUE_COLLECTION" as const, label: hasIntegrityPending ? "Corrigir coleta" : "Continuar coleta clínica", href: collectionHref, primary: true },
          ...(collection.progressPercent > 0 ? [{ key: "REVIEW_COLLECTION" as const, label: "Revisar coleta", href: `${collectionHref}&step=ANTHROPOMETRY`, primary: false }] : []),
        ];
  const recordProgress = records.map(([label, record]) => progressStep(label, record.status === "COMPLETED" ? "COMPLETED" : record.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING", record.status === "COMPLETED" ? "Concluído" : record.status === "IN_PROGRESS" ? "Em andamento" : "Pendente"));
  const maria = collection.connectedProfessional.professionalName === "Maria de Lourdes Gomes";
  const panelState = readStoredPanel(collection.scenario);
  return {
    patientId: collection.patientId,
    attendanceId: collection.attendanceId,
    scenario: collection.scenario,
    consultationType: collection.consultationType,
    responsibleProfessionalName: collection.connectedProfessional.professionalName,
    startedAt: "2026-07-16T08:30:00-03:00",
    updatedAt: [collection.connectedProfessional.updatedAt, collection.records.anthropometry.audit?.updatedAt, collection.records.bioimpedance.audit?.updatedAt, collection.records.perimetry.audit?.updatedAt, collection.records.posturalAssessment.audit?.updatedAt].filter((date): date is string => Boolean(date)).sort().at(-1) ?? collection.connectedProfessional.updatedAt,
    progressPercent: collection.progressPercent,
    lastCompletedStep: completedLabels.at(-1),
    nextPendingStep: nextPending ?? (isComplete ? "Painel Clínico Integrado" : "Concluir coleta"),
    status: isNotStarted ? "NOT_STARTED" : hasIntegrityPending ? "INTEGRITY_PENDING" : isComplete ? "COLLECTION_COMPLETE" : "IN_PROGRESS",
    statusLabel: isNotStarted ? "Coleta não iniciada" : hasIntegrityPending ? "Pendências de integridade" : isComplete ? "Coleta concluída" : "Coleta em andamento",
    progress: [
      progressStep("Cadastro", "COMPLETED", "Concluído"),
      progressStep("Anamnese", "PENDING", "Ainda não iniciado"),
      ...recordProgress,
      progressStep("Painel Clínico", panelState.confirmedAt ? "COMPLETED" : isComplete ? "IN_PROGRESS" : "BLOCKED", panelState.confirmedAt ? "Concluído" : isComplete ? "Disponível" : "Bloqueado"),
      progressStep("Plano Alimentar", maria ? "NOT_APPLICABLE" : "PENDING", maria ? "Não aplicável" : "Ainda não iniciado"),
      progressStep("Plano de Treino", "PENDING", "Ainda não iniciado"),
      progressStep("Entregáveis", "PENDING", "Ainda não iniciado"),
      progressStep("Finalização", isComplete ? "PENDING" : "BLOCKED", isComplete ? "Disponível" : "Bloqueado"),
    ],
    actions,
  };
}

export const mockClinicalCollectionGateway: ClinicalCollectionGateway = {
  async listScenarios() {
    return clinicalCollectionScenarios;
  },
  async getCollection({ patientId, attendanceId, scenario = "partial-saulo" }) {
    if (patientId !== CLINICAL_DEMO_PATIENT_ID || attendanceId !== CLINICAL_DEMO_ATTENDANCE_ID) return null;
    return getScenario(scenario);
  },
  async saveStep(input) {
    let collection = getScenario(input.scenario);
    if (!collection.canEdit) throw new Error("PERMISSION_DENIED");
    let data = clone(input.data);
    if (input.step === "ANTHROPOMETRY") {
      const anthropometry = data as AnthropometryData;
      const bmi = anthropometry.weightKg && anthropometry.heightCm
        ? Math.round((anthropometry.weightKg / ((anthropometry.heightCm / 100) ** 2)) * 10) / 10
        : undefined;
      data = { ...anthropometry, bmi };
    }
    const key = recordKey[input.step];
    const previous = collection.records[key];
    const updatedAt = new Date().toISOString();
    const updatedRecord = {
      ...previous,
      data,
      origin: previous.origin ?? {
        masterRecordId: collection.masterRecordId,
        entryId: `mock-entry-${input.step.toLocaleLowerCase("en-US")}`,
        moduleKey: moduleByStep[input.step],
        label: "Coleta atual · mock",
      },
      audit: {
        ...collection.connectedProfessional,
        updatedAt,
        version: (previous.audit?.version ?? 0) + 1,
      },
    };
    collection = recompute({ ...collection, records: { ...collection.records, [key]: updatedRecord }, lastSavedStep: input.step });
    storeCollection(input.scenario, collection);
    return { collection: clone(collection), savedAt: updatedAt, persisted: false };
  },
  async completeCollection({ patientId, attendanceId, scenario = "partial-saulo" }) {
    const collection = await this.getCollection({ patientId, attendanceId, scenario });
    if (!collection) throw new Error("COLLECTION_NOT_FOUND");
    if (!collection.nutritionFlowReady) throw new Error("MANDATORY_STEPS_PENDING");
    const completed = {
      ...collection,
      completed: true,
      firstIncompleteStep: "SUMMARY" as const,
      nextAttendanceStep: "Estratégia Nutricional",
    };
    storeCollection(scenario, completed);
    return { collection: clone(completed), persisted: false, nextAttendanceStep: "Estratégia Nutricional" };
  },
  async getCurrentAttendance({ patientId, attendanceId, scenario = "complete" }) {
    if (patientId !== CLINICAL_DEMO_PATIENT_ID || attendanceId !== CLINICAL_DEMO_ATTENDANCE_ID) return null;
    return currentAttendance(getScenario(scenario));
  },
  async getClinicalPanel({ patientId, attendanceId, scenario = "complete" }) {
    if (patientId !== CLINICAL_DEMO_PATIENT_ID || attendanceId !== CLINICAL_DEMO_ATTENDANCE_ID) return null;
    return getPanel(getScenario(scenario));
  },
  async updateClinicalPanel({ patientId, attendanceId, scenario = "complete" }) {
    if (patientId !== CLINICAL_DEMO_PATIENT_ID || attendanceId !== CLINICAL_DEMO_ATTENDANCE_ID) throw new Error("PANEL_NOT_FOUND");
    const panel = getPanel(getScenario(scenario));
    if (!panel.accessible) throw new Error("COLLECTION_INTEGRITY_PENDING");
    const currentState = readStoredPanel(scenario);
    const updatedAt = new Date().toISOString();
    const updatedState = { ...currentState, confirmedAt: updatedAt, confirmedBy: { ...panel.collection.connectedProfessional, updatedAt }, nextModule: "Motor de Decisão Clínica" as const };
    storePanel(scenario, updatedState);
    return { panel: getPanel(panel.collection), persisted: false };
  },
};
