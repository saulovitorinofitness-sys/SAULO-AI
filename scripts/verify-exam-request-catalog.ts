import { createHash } from "node:crypto";

import { examRequestService } from "../src/features/exam-requests/service";
import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const marker = "TESTE — dados simulados — catálogo persistido e CRN confirmado";
const patient = await prisma.patient.findFirst({
  where: { clinicalCode: "SV000006", status: "ACTIVE", deletedAt: null },
  select: { id: true, clinicalCode: true, fullName: true },
});
if (!patient) throw new Error("Paciente de teste SV000006 não encontrado.");

const beforePublished = await prisma.deliverable.findMany({
  where: { kind: "EXAM_REQUEST", status: "PUBLISHED", deletedAt: null },
  select: { id: true, version: true, updatedAt: true, metadata: true },
});
const beforeFingerprints = new Map(beforePublished.map((request) => [
  request.id,
  createHash("sha256").update(JSON.stringify({
    version: request.version,
    updatedAt: request.updatedAt.toISOString(),
    metadata: request.metadata,
  })).digest("hex"),
]));

const catalog = await examRequestService.listCatalog();
const tsh = catalog.find((item) => item.synonyms.some((synonym) => synonym.toLocaleLowerCase("pt-BR") === "tsh"));
const hemogram = catalog.find((item) => item.name === "Hemograma completo");
if (!tsh || !hemogram) throw new Error("Busca do catálogo por nome ou sinônimo falhou.");
if (catalog.some((item) => item.source !== "PERSISTED")) throw new Error("Catálogo não persistido encontrado.");

const actorUserId = BUILT_IN_IDS.users.sauloXavierVitorino;
const current = (await examRequestService.list(patient.id))
  .find((request) => request.content.orientations === marker);
let request = current;
let created = false;

if (!request) {
  request = await examRequestService.saveDraft({
    patientId: patient.id,
    actorUserId,
    content: {
      requestedExams: [tsh.name, hemogram.name],
      orientations: marker,
    },
  });
  created = true;
}

const reopened = await examRequestService.get(patient.id, request.id);
if (!reopened || reopened.content.requestedExams.join("|") !== [tsh.name, hemogram.name].join("|")) {
  throw new Error("Rascunho não reabriu com os exames selecionados.");
}
if (reopened.status === "DRAFT") {
  request = await examRequestService.issue({
    patientId: patient.id,
    requestId: reopened.id,
    actorUserId,
    content: reopened.content,
  });
} else {
  request = reopened;
}

if (request.issuedSnapshot?.professional.fullName !== "Saulo Xavier Vitorino") {
  throw new Error("Nome profissional ausente do snapshot novo.");
}
if (request.issuedSnapshot.professional.nutritionTitle !== "Nutricionista") {
  throw new Error("Título profissional ausente do snapshot novo.");
}
if (request.issuedSnapshot.professional.crnRegistration !== "CRN 11 — 22529/P-CE") {
  throw new Error("CRN confirmado ausente do snapshot novo.");
}

const afterPublished = await prisma.deliverable.findMany({
  where: { id: { in: [...beforeFingerprints.keys()] } },
  select: { id: true, version: true, updatedAt: true, metadata: true },
});
for (const previous of afterPublished) {
  if (previous.id === request.id && !beforeFingerprints.has(request.id)) continue;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    version: previous.version,
    updatedAt: previous.updatedAt.toISOString(),
    metadata: previous.metadata,
  })).digest("hex");
  if (fingerprint !== beforeFingerprints.get(previous.id)) {
    throw new Error(`Documento emitido anteriormente foi alterado: ${previous.id}`);
  }
}

console.log(JSON.stringify({
  patient: { id: patient.id, clinicalCode: patient.clinicalCode, fullName: patient.fullName },
  catalog: {
    count: catalog.length,
    categories: new Set(catalog.map((item) => item.category)).size,
    synonymSearch: { query: "TSH", result: tsh.name },
    nameSearch: { query: "Hemograma completo", result: hemogram.name },
  },
  request: {
    id: request.id,
    created,
    status: request.status,
    requestedExams: request.content.requestedExams,
    professional: request.issuedSnapshot.professional,
  },
  previousPublishedDocumentsUnchanged: afterPublished.length,
}, null, 2));
