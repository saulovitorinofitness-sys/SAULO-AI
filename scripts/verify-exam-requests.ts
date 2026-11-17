import { examRequestService } from "../src/features/exam-requests/service";
import { EXAM_REQUEST_KIND } from "../src/features/exam-requests/contracts";
import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const legacyMarker = "TESTE — dados simulados — Exame laboratorial A";
const shortMarker = "TESTE — dados simulados — solicitação curta v2";
const longMarker = "TESTE — dados simulados — solicitação longa v2 — item 01";
const patient = await prisma.patient.findFirst({
  where: { clinicalCode: "SV000006", status: "ACTIVE", deletedAt: null },
  select: { id: true, clinicalCode: true, fullName: true, cpf: true },
});
if (!patient) throw new Error("Paciente de teste SV000006 não encontrado.");
const otherPatient = await prisma.patient.findFirst({
  where: { id: { not: patient.id }, status: "ACTIVE", deletedAt: null },
  orderBy: { clinicalCode: "asc" },
  select: { id: true, clinicalCode: true },
});
if (!otherPatient) throw new Error("Segunda pessoa não encontrada para validar isolamento.");

const actorUserId = BUILT_IN_IDS.users.sauloXavierVitorino;
const initial = await examRequestService.list(patient.id);
const legacy = initial.find((request) => request.content.requestedExams.includes(legacyMarker));
const legacyBefore = legacy ? await prisma.deliverable.findUnique({ where: { id: legacy.id }, select: { version: true, updatedAt: true, metadata: true } }) : null;

async function shortRequest() {
  const current = (await examRequestService.list(patient.id)).find((request) => request.content.requestedExams.includes(shortMarker));
  if (current?.status === "PUBLISHED") return { request: current, created: false };
  const draft = current ?? await examRequestService.saveDraft({
    patientId: patient.id,
    actorUserId,
    content: {
      requestedExams: [shortMarker, "TESTE — dados simulados — item removível"],
      includePatientCpf: Boolean(patient.cpf),
    },
  });
  const reopened = await examRequestService.get(patient.id, draft.id);
  if (!reopened || reopened.status !== "DRAFT") throw new Error("Falha ao reabrir o rascunho curto.");
  const revised = await examRequestService.saveDraft({
    patientId: patient.id,
    requestId: draft.id,
    actorUserId,
    content: {
      requestedExams: ["TESTE — dados simulados — item adicionado", shortMarker],
      includePatientCpf: Boolean(patient.cpf),
      orientations: "TESTE — dados simulados — sem finalidade clínica.",
    },
  });
  if (revised.content.requestedExams.includes("TESTE — dados simulados — item removível")) throw new Error("Falha ao remover exame do rascunho.");
  const reopenedRevision = await examRequestService.get(patient.id, revised.id);
  if (!reopenedRevision || reopenedRevision.content.requestedExams[0] !== "TESTE — dados simulados — item adicionado") throw new Error("Falha ao preservar a reorganização.");
  return {
    request: await examRequestService.issue({ patientId: patient.id, requestId: revised.id, actorUserId, content: revised.content }),
    created: !current,
  };
}

async function longRequest() {
  const current = (await examRequestService.list(patient.id)).find((request) => request.content.requestedExams.includes(longMarker));
  if (current?.status === "PUBLISHED") return { request: current, created: false };
  const requestedExams = Array.from({ length: 34 }, (_, index) => `TESTE — dados simulados — solicitação longa v2 — item ${String(index + 1).padStart(2, "0")} — descrição extensa para validar quebra de página e legibilidade`);
  const draft = current ?? await examRequestService.saveDraft({ patientId: patient.id, actorUserId, content: { requestedExams } });
  return {
    request: await examRequestService.issue({ patientId: patient.id, requestId: draft.id, actorUserId, content: { requestedExams } }),
    created: !current,
  };
}

const short = await shortRequest();
const long = await longRequest();
for (const request of [short.request, long.request]) {
  if (request.status !== "PUBLISHED" || !request.issuedSnapshot) throw new Error("Emissão sem snapshot v2.");
  const leaked = (await examRequestService.list(otherPatient.id)).some((candidate) => candidate.id === request.id);
  if (leaked) throw new Error("Falha de isolamento entre pessoas.");
}

const legacyAfter = legacy ? await prisma.deliverable.findUnique({ where: { id: legacy.id }, select: { version: true, updatedAt: true, metadata: true } }) : null;
if (legacyBefore && legacyAfter && (legacyBefore.version !== legacyAfter.version || legacyBefore.updatedAt.getTime() !== legacyAfter.updatedAt.getTime() || JSON.stringify(legacyBefore.metadata) !== JSON.stringify(legacyAfter.metadata))) {
  throw new Error("Documento emitido anteriormente foi alterado.");
}

console.log(JSON.stringify({
  patient: { code: patient.clinicalCode, name: patient.fullName },
  isolatedFromPatientCode: otherPatient.clinicalCode,
  legacyDocumentUnchanged: Boolean(legacyBefore && legacyAfter),
  catalog: await examRequestService.listCatalog(),
  short: { created: short.created, requestId: short.request.id, historyEntries: short.request.history.length, includesCpf: Boolean(short.request.issuedSnapshot?.patient.cpf) },
  long: { created: long.created, requestId: long.request.id, historyEntries: long.request.history.length, examCount: long.request.content.requestedExams.length },
  kind: EXAM_REQUEST_KIND,
}, null, 2));
