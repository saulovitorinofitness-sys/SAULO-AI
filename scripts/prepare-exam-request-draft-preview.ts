import { examRequestService } from "../src/features/exam-requests/service";
import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const marker = "TESTE — SEM VALIDADE CLÍNICA";
const patient = await prisma.patient.findFirst({
  where: { clinicalCode: "SV000006", status: "ACTIVE", deletedAt: null },
  select: { id: true, clinicalCode: true, fullName: true },
});
if (!patient) throw new Error("Pessoa de teste SV000006 não encontrada.");

const catalog = await examRequestService.listCatalog();
const selectedNames = [
  "Hemograma completo",
  "Glicemia de jejum",
  "Colesterol total",
  "Creatinina",
  "Hormônio estimulante da tireoide",
];
const selected = selectedNames.map((name) => {
  const item = catalog.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`Exame não encontrado no catálogo: ${name}`);
  return item;
});

const matching = (await examRequestService.list(patient.id)).filter((request) =>
  request.status === "DRAFT" && request.content.justification === marker,
);
if (matching.length > 1) throw new Error("Há mais de um rascunho com o marcador de teste.");

const draft = matching[0] ?? await examRequestService.saveDraft({
  patientId: patient.id,
  actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
  content: {
    requestedExams: selected.slice(0, 4).map((item) => item.name),
    justification: marker,
  },
});
if (draft.status !== "DRAFT") throw new Error("A solicitação de teste não está em rascunho.");

console.log(JSON.stringify({
  patient,
  draft: {
    id: draft.id,
    status: draft.status,
    requestedExams: draft.content.requestedExams,
    marker: draft.content.justification,
  },
  fifthExam: selected[4],
}, null, 2));
