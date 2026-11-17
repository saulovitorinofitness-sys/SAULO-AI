import type {
  ExamRequestContent,
  ExamRequestPatientOption,
  ExamCatalogItem,
  ExamRequestView,
} from "./contracts";
import { examRequestRepository } from "./repository";

const MAX_EXAMS = 80;
const MAX_EXAM_LENGTH = 240;
const MAX_OPTIONAL_LENGTH = 4_000;

export class ExamRequestValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function optionalText(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ExamRequestValidationError("INVALID_CONTENT", `${field} inválido.`);
  }
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_OPTIONAL_LENGTH) {
    throw new ExamRequestValidationError(
      "CONTENT_TOO_LONG",
      `${field} deve ter no máximo ${MAX_OPTIONAL_LENGTH} caracteres.`,
    );
  }
  return normalized;
}

export function normalizeExamRequestContent(value: unknown): ExamRequestContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExamRequestValidationError("INVALID_CONTENT", "Conteúdo da solicitação inválido.");
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.requestedExams)) {
    throw new ExamRequestValidationError("INVALID_CONTENT", "Informe os exames solicitados.");
  }
  const requestedExams = raw.requestedExams
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .filter((item, index, all) => {
      const key = item.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("pt-BR");
      return all.findIndex((candidate) => candidate.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("pt-BR") === key) === index;
    });
  if (requestedExams.length > MAX_EXAMS) {
    throw new ExamRequestValidationError("TOO_MANY_EXAMS", `Informe no máximo ${MAX_EXAMS} exames.`);
  }
  if (requestedExams.some((item) => item.length > MAX_EXAM_LENGTH)) {
    throw new ExamRequestValidationError(
      "EXAM_TOO_LONG",
      `Cada exame deve ter no máximo ${MAX_EXAM_LENGTH} caracteres.`,
    );
  }
  return {
    requestedExams,
    justification: optionalText(raw.justification, "Justificativa"),
    orientations: optionalText(raw.orientations, "Orientações"),
  };
}

function requireIdentifiers(patientId: string, requestId?: string) {
  if (!patientId || patientId.length > 100) {
    throw new ExamRequestValidationError("INVALID_PATIENT", "Pessoa inválida.");
  }
  if (requestId !== undefined && (!requestId || requestId.length > 100)) {
    throw new ExamRequestValidationError("INVALID_REQUEST", "Solicitação inválida.");
  }
}

export const examRequestService = {
  listCatalog(): Promise<readonly ExamCatalogItem[]> {
    return examRequestRepository.listCatalog();
  },
  getPatient(patientId: string): Promise<ExamRequestPatientOption | null> {
    requireIdentifiers(patientId);
    return examRequestRepository.getPatient(patientId);
  },

  searchPatients(query?: string): Promise<readonly ExamRequestPatientOption[]> {
    return examRequestRepository.searchPatients(query);
  },

  list(patientId: string): Promise<readonly ExamRequestView[]> {
    requireIdentifiers(patientId);
    return examRequestRepository.listForPatient(patientId);
  },

  get(patientId: string, requestId: string): Promise<ExamRequestView | null> {
    requireIdentifiers(patientId, requestId);
    return examRequestRepository.get(patientId, requestId);
  },

  saveDraft(input: {
    readonly patientId: string;
    readonly requestId?: string;
    readonly actorUserId: string;
    readonly content: unknown;
  }): Promise<ExamRequestView> {
    requireIdentifiers(input.patientId, input.requestId);
    const content = normalizeExamRequestContent(input.content);
    return input.requestId
      ? examRequestRepository.revise({
          patientId: input.patientId,
          requestId: input.requestId,
          actorUserId: input.actorUserId,
          content,
          issue: false,
        })
      : examRequestRepository.createDraft({
          patientId: input.patientId,
          actorUserId: input.actorUserId,
          content,
        });
  },

  issue(input: {
    readonly patientId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly content: unknown;
  }): Promise<ExamRequestView> {
    requireIdentifiers(input.patientId, input.requestId);
    const content = normalizeExamRequestContent(input.content);
    if (content.requestedExams.length === 0) {
      throw new ExamRequestValidationError(
        "EXAMS_REQUIRED_TO_ISSUE",
        "Inclua ao menos um exame antes de emitir.",
      );
    }
    return examRequestRepository.revise({
      patientId: input.patientId,
      requestId: input.requestId,
      actorUserId: input.actorUserId,
      content,
      issue: true,
    });
  },
};
