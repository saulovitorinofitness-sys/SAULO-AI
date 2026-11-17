import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { InitialConsultationProgress } from "../../components/patients/initial-consultation-progress";
import {
  isVisibleNutritionClinicalFlowStep,
  NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
} from "../nutrition-clinical-flow/flow";
import {
  planClinicalAttendance,
  resolvePatientClinicalStatus,
} from "./attendance-rules";
import {
  cancelledPreparedAttendanceState,
  preparedAttendanceState,
  startedAttendanceState,
} from "./attendance-state-machine";

const patientId = "patient-1";
const masterRecordId = "master-record-1";

function patientFixture(attendances: readonly Record<string, unknown>[]) {
  return {
    id: patientId,
    clinicalCode: "SV000001",
    fullName: "Paciente de teste",
    preferredName: null,
    birthDate: new Date("1990-01-01T00:00:00.000Z"),
    sex: "FEMALE",
    phones: [],
    masterRecord: {
      id: masterRecordId,
      attendances,
      continuity: { steps: [] },
    },
  };
}

async function repositoryHarness(
  patient: ReturnType<typeof patientFixture> | null,
  completedAttendance: Record<string, unknown> | null,
) {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const queries: Record<string, unknown>[] = [];
  let writes = 0;
  const prisma = {
    patient: { findUnique: async () => patient },
    attendance: {
      findFirst: async (query: Record<string, unknown>) => {
        queries.push(query);
        return completedAttendance;
      },
    },
    $transaction: () => { writes++; throw new Error("Unexpected write"); },
  };
  const compiledModule = { exports: {} as { patientRegistrationRepository?: {
    findEntry: (id: string) => Promise<unknown>;
  } } };
  runInNewContext(compiled, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(id: string) {
      if (id === "node:crypto") return { randomUUID: () => "test-uuid" };
      if (id === "@/lib/database/prisma") return { prisma };
      if (id === "@/features/identity/cpf-ownership") return { assertCpfAvailableForPerson: async () => undefined };
      if (id === "./contracts") return { PATIENT_LIST_PAGE_SIZE: 20 };
      if (id === "./attendance-rules") return {
        planClinicalAttendance,
        resolvePatientClinicalStatus,
      };
      if (id === "./attendance-state-machine") return {
        cancelledPreparedAttendanceState,
        preparedAttendanceState,
        startedAttendanceState,
      };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  assert.ok(compiledModule.exports.patientRegistrationRepository);
  return {
    findEntry: compiledModule.exports.patientRegistrationRepository.findEntry,
    queries,
    get writes() { return writes; },
  };
}

test("paciente com atendimento aberto preserva continuidade e pode editar", async () => {
  const active = {
    id: "attendance-open",
    status: "IN_PROGRESS",
    startedAt: new Date("2026-09-01T12:00:00.000Z"),
    receivedAt: new Date("2026-09-01T12:00:00.000Z"),
  };
  const harness = await repositoryHarness(patientFixture([active]), null);
  const entry = await harness.findEntry(patientId) as {
    activeAttendance?: { id: string };
    canEdit: boolean;
  };
  assert.equal(entry.activeAttendance?.id, active.id);
  assert.equal(entry.canEdit, true);
  assert.equal(harness.writes, 0);
});

test("retorno aberto e atendimento anterior concluído permanecem no mesmo MasterRecord", async () => {
  const active = {
    id: "attendance-return-open",
    status: "IN_PROGRESS",
    clinicalType: "RETURN",
    startedAt: new Date("2026-10-06T12:00:00.000Z"),
    receivedAt: new Date("2026-10-06T12:00:00.000Z"),
  };
  const completed = {
    id: "attendance-previous-completed",
    clinicalType: "FIRST_CONSULTATION",
    startedAt: new Date("2026-09-01T12:00:00.000Z"),
    receivedAt: new Date("2026-09-01T12:00:00.000Z"),
    endedAt: new Date("2026-09-01T13:00:00.000Z"),
  };
  const harness = await repositoryHarness(patientFixture([active]), completed);
  const entry = await harness.findEntry(patientId) as {
    masterRecordId: string;
    activeAttendance?: { id: string; clinicalType?: string };
    historicalAttendance?: { id: string; clinicalType?: string; status: string };
  };

  assert.equal(entry.masterRecordId, masterRecordId);
  assert.deepEqual(
    JSON.parse(JSON.stringify(entry.activeAttendance)),
    {
      id: active.id,
      status: "IN_PROGRESS",
      clinicalType: "RETURN",
      preparedAt: active.receivedAt.toISOString(),
      startedAt: active.startedAt.toISOString(),
    },
  );
  assert.equal(entry.historicalAttendance?.id, completed.id);
  assert.equal(entry.historicalAttendance?.clinicalType, "FIRST_CONSULTATION");
  assert.equal(entry.historicalAttendance?.status, "COMPLETED");
  assert.equal(harness.writes, 0);
});

test("paciente apenas com atendimento concluído mantém o MasterRecord e histórico vinculado", async () => {
  const completed = {
    id: "attendance-completed",
    startedAt: new Date("2026-08-01T12:00:00.000Z"),
    receivedAt: new Date("2026-08-01T12:00:00.000Z"),
    endedAt: new Date("2026-08-01T13:00:00.000Z"),
  };
  const harness = await repositoryHarness(patientFixture([]), completed);
  const first = await harness.findEntry(patientId) as {
    masterRecordId: string;
    activeAttendance?: unknown;
    historicalAttendance?: { id: string; status: string };
    canEdit: boolean;
  };
  await harness.findEntry(patientId);
  assert.equal(first.masterRecordId, masterRecordId);
  assert.equal(first.activeAttendance, undefined);
  assert.equal(first.historicalAttendance?.id, completed.id);
  assert.equal(first.historicalAttendance?.status, "COMPLETED");
  assert.equal(first.canEdit, false);
  assert.equal(harness.writes, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.queries[0].where)), {
    masterRecordId,
    status: "COMPLETED",
    deletedAt: null,
    masterRecord: { patientId, patient: { deletedAt: null } },
  });
});

test("paciente com MasterRecord e sem atendimento não vira 404", async () => {
  const harness = await repositoryHarness(patientFixture([]), null);
  const entry = await harness.findEntry(patientId) as {
    masterRecordId: string;
    activeAttendance?: unknown;
    historicalAttendance?: unknown;
    canEdit: boolean;
  };
  assert.equal(entry.masterRecordId, masterRecordId);
  assert.equal(entry.activeAttendance, undefined);
  assert.equal(entry.historicalAttendance, undefined);
  assert.equal(entry.canEdit, false);
  assert.equal(harness.writes, 0);
});

test("patientId inexistente continua sem registro", async () => {
  const harness = await repositoryHarness(null, null);
  assert.equal(await harness.findEntry("missing-patient"), null);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes, 0);
});

test("histórico e prontuário sem atendimento não oferecem edição", () => {
  const base = {
    patientId,
    clinicalCode: "SV000001",
    fullName: "Paciente de teste",
    birthDate: "1990-01-01",
    age: 36,
    sex: "FEMALE" as const,
    phone: "",
    masterRecordId,
    canEdit: false,
    steps: [],
  };
  const historicalHtml = renderToStaticMarkup(createElement(InitialConsultationProgress, {
    patient: {
      ...base,
      historicalAttendance: {
        id: "attendance-completed",
        status: "COMPLETED",
        preparedAt: "2026-08-01T12:00:00.000Z",
        startedAt: "2026-08-01T12:00:00.000Z",
      },
    },
    registered: false,
  }));
  const emptyHtml = renderToStaticMarkup(createElement(InitialConsultationProgress, {
    patient: base,
    registered: false,
  }));
  assert.match(historicalHtml, /Atendimento concluído/);
  assert.match(historicalHtml, /Visualização histórica em modo somente leitura/);
  assert.doesNotMatch(historicalHtml, /Continuar atendimento|Abrir módulo/);
  assert.match(emptyHtml, /Nenhum atendimento registrado/);
  assert.doesNotMatch(emptyHtml, /Continuar atendimento|Abrir módulo/);
});

test("página histórica é leitura e continuar não seleciona concluído", async () => {
  const [page, continuation] = await Promise.all([
    readFile(new URL("../../app/(authenticated)/pacientes/[patientId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(authenticated)/pacientes/[patientId]/continuar/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /selectedAttendance\.id/);
  assert.match(page, /Visualização histórica/);
  assert.match(page, /NewAttendanceDialog/);
  assert.doesNotMatch(continuation, /latestAttendance|status: "COMPLETED"/);
  assert.match(continuation, /if \(!attendance \|\| attendance\.status === "DRAFT"\) \{\s*redirect\(`\/pacientes\/\$\{patientId\}`\)/);
});

test("abrir e atualizar prontuário histórico não executa escrita", async () => {
  const source = await readFile(
    new URL("../../app/(authenticated)/pacientes/[patientId]/page.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const visibleText = (node: unknown): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(visibleText).join(" ");
    if (node && typeof node === "object" && "props" in node) {
      return visibleText((node as { props: { children?: unknown } }).props.children);
    }
    return "";
  };
  const flowCalls: { patientId: string; attendanceId: string }[] = [];
  let writes = 0;
  const historicalEntry = {
    patientId,
    masterRecordId,
    fullName: "Paciente de teste",
    clinicalCode: "SV000001",
    historicalAttendance: {
      id: "attendance-completed",
      status: "COMPLETED",
      startedAt: "2026-08-01T12:00:00.000Z",
    },
  };
  const compiledModule = { exports: {} as { default?: (props: {
    params: Promise<{ patientId: string }>;
    searchParams: Promise<Record<string, string>>;
  }) => Promise<unknown> } };
  runInNewContext(compiled, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(id: string) {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (id === "next/dynamic") return { default: () => "PatientHubLazy" };
      if (id === "next/navigation") return {
        notFound: () => { throw new Error("Unexpected 404"); },
        redirect: () => { throw new Error("Unexpected redirect"); },
      };
      if (id === "@/components/master-record/patient-navigation") return { PatientNavigation: "PatientNavigation" };
      if (id === "@/components/nutrition-clinical-flow/clinical-flow-navigation") return { ClinicalFlowNavigation: "ClinicalFlowNavigation" };
      if (id === "@/components/patients/initial-consultation-progress") return { InitialConsultationProgress: "InitialConsultationProgress" };
      if (id === "@/components/ui/page-state") return { PageState: "PageState" };
      if (id === "@/components/patients/new-attendance-dialog") return {
        NewAttendanceDialog: "NewAttendanceDialog",
      };
      if (id === "@/features/clinical-collection") return { CLINICAL_COLLECTION_SCENARIO_KEYS: [] };
      if (id === "@/features/mvp") return {
        mvpService: { getSession: async () => ({ user: { id: "professional-1" } }) },
        canAccess: () => true,
      };
      if (id === "@/features/mvp/mock-data") return { DEMO_PATIENT_ID: "demo-patient-001" };
      if (id === "@/features/nutrition-clinical-flow/repository") return {
        nutritionClinicalFlowRepository: {
          getFlow: async (input: { patientId: string; attendanceId: string }) => {
            flowCalls.push(input);
            return { flow: [
              { id: "PATIENT_REGISTRATION", title: "Cadastro", status: "COMPLETED" },
              { id: "ANAMNESIS", title: "Anamnese Clínica", status: "COMPLETED" },
              { id: "ANTHROPOMETRY", title: "Antropometria", status: "COMPLETED" },
              { id: "PERIMETRY", title: "Perimetria", status: "SKIPPED" },
              { id: "BIOIMPEDANCE", title: "Bioimpedância", status: "SKIPPED" },
              { id: "POSTURAL_ASSESSMENT", title: "Avaliação Postural", status: "SKIPPED" },
              { id: "PERFORMANCE", title: "Performance", status: "SKIPPED" },
              { id: "NUTRITION_STRATEGY", title: "Estratégia Nutricional", status: "SKIPPED" },
              { id: "MEAL_PLAN", title: "Plano Alimentar", status: "SKIPPED" },
              { id: "DELIVERABLES", title: "Entregáveis", status: "NOT_STARTED" },
              { id: "FINALIZE_ATTENDANCE", title: "Finalizar Atendimento", status: "COMPLETED" },
            ] };
          },
        },
      };
      if (id === "@/features/nutrition-clinical-flow/flow") return {
        isVisibleNutritionClinicalFlowStep,
        NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
      };
      if (id === "@/features/patient-hub") return { patientHubService: {} };
      if (id === "@/features/patient-registration") return {
        patientRegistrationRepository: {
          findEntry: async () => historicalEntry,
          ensureOpenAttendance: async () => { writes++; },
        },
      };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  assert.ok(compiledModule.exports.default);
  const input = {
    params: Promise.resolve({ patientId }),
    searchParams: Promise.resolve({}),
  };
  const rendered = await compiledModule.exports.default(input);
  await compiledModule.exports.default(input);
  const historicalText = visibleText(rendered);
  assert.match(historicalText, /Cadastro\s+Concluída/);
  assert.match(historicalText, /Anamnese Clínica\s+Concluída/);
  assert.match(historicalText, /Antropometria\s+Concluída/);
  assert.match(historicalText, /Perimetria\s+Não realizada/);
  assert.match(historicalText, /Bioimpedância\s+Não realizada/);
  assert.match(historicalText, /Finalizar Atendimento\s+Concluída/);
  assert.doesNotMatch(historicalText, /Entregáveis/);
  assert.equal(writes, 0);
  assert.equal(flowCalls.length, 2);
  assert.deepEqual(flowCalls.map((call) => call.attendanceId), [
    "attendance-completed",
    "attendance-completed",
  ]);
});
