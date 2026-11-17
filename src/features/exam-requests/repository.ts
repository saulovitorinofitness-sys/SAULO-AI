import { randomUUID } from "node:crypto";

import {
  clinicInstitutionalDocumentIdentity,
  type InstitutionalDocumentIdentity,
} from "@/config/institution";
import type { Prisma } from "@/generated/prisma/client";
import { physicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";
import { prisma } from "@/lib/database/prisma";

import {
  EXAM_REQUEST_KIND,
  EXAM_REQUEST_SCHEMA_VERSION,
  type ExamRequestContent,
  type ExamRequestHistoryAction,
  type ExamRequestHistoryEntry,
  type ExamRequestMetadata,
  type ExamRequestIssuedSnapshot,
  type ExamCatalogItem,
  type ExamRequestPatientOption,
  type ExamRequestView,
} from "./contracts";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseContent(value: unknown): ExamRequestContent | null {
  const content = objectValue(value);
  if (!content || !Array.isArray(content.requestedExams)) return null;
  const requestedExams = content.requestedExams.filter(
    (item): item is string => typeof item === "string",
  );
  if (requestedExams.length !== content.requestedExams.length) return null;
  if (content.justification !== undefined && typeof content.justification !== "string") return null;
  if (content.orientations !== undefined && typeof content.orientations !== "string") return null;
  if (content.includePatientCpf !== undefined && typeof content.includePatientCpf !== "boolean") return null;
  return {
    requestedExams,
    ...(content.justification ? { justification: content.justification } : {}),
    ...(content.orientations ? { orientations: content.orientations } : {}),
    ...(content.includePatientCpf ? { includePatientCpf: true } : {}),
  };
}

function parseIssuedSnapshot(value: unknown): ExamRequestIssuedSnapshot | null {
  const snapshot = objectValue(value);
  const patient = objectValue(snapshot?.patient);
  const professional = objectValue(snapshot?.professional);
  if (
    !snapshot || !patient || !professional ||
    typeof patient.id !== "string" ||
    typeof patient.clinicalCode !== "string" ||
    typeof patient.fullName !== "string" ||
    typeof patient.birthDate !== "string" ||
    (patient.cpf !== undefined && typeof patient.cpf !== "string") ||
    typeof professional.fullName !== "string" ||
    (professional.nutritionTitle !== undefined && typeof professional.nutritionTitle !== "string") ||
    (professional.crnRegistration !== undefined && typeof professional.crnRegistration !== "string")
  ) return null;
  const institution = snapshot.institution === undefined
    ? undefined
    : parseInstitutionalIdentity(snapshot.institution);
  if (snapshot.institution !== undefined && !institution) return null;
  return {
    patient: {
      id: patient.id,
      clinicalCode: patient.clinicalCode,
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      ...(patient.cpf ? { cpf: patient.cpf } : {}),
    },
    professional: {
      fullName: professional.fullName,
      ...(professional.nutritionTitle ? { nutritionTitle: professional.nutritionTitle } : {}),
      ...(professional.crnRegistration ? { crnRegistration: professional.crnRegistration } : {}),
    },
    ...(institution ? { institution } : {}),
  };
}

function parseInstitutionalIdentity(value: unknown): InstitutionalDocumentIdentity | null {
  const identity = objectValue(value);
  const address = objectValue(identity?.address);
  if (
    !identity || !address ||
    typeof identity.displayName !== "string" ||
    typeof identity.shortName !== "string" ||
    typeof identity.documentSubtitle !== "string" ||
    typeof identity.website !== "string" ||
    typeof address.street !== "string" ||
    typeof address.number !== "string" ||
    (address.complement !== undefined && typeof address.complement !== "string") ||
    typeof address.neighborhood !== "string" ||
    typeof address.city !== "string" ||
    typeof address.state !== "string" ||
    typeof address.postalCode !== "string" ||
    !Array.isArray(identity.contacts)
  ) return null;
  const contacts = identity.contacts.map((value) => objectValue(value));
  if (contacts.some((contact) => !contact || typeof contact.label !== "string" || typeof contact.value !== "string")) return null;
  return {
    displayName: identity.displayName,
    shortName: identity.shortName,
    documentSubtitle: identity.documentSubtitle,
    website: identity.website,
    address: {
      street: address.street,
      number: address.number,
      ...(typeof address.complement === "string" ? { complement: address.complement } : {}),
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    },
    contacts: contacts.map((contact) => ({ label: contact!.label as string, value: contact!.value as string })),
  };
}

export function parseExamRequestMetadata(value: unknown): ExamRequestMetadata | null {
  const metadata = objectValue(value);
  const content = parseContent(metadata?.content);
  if (
    !metadata ||
    ![1, 2, EXAM_REQUEST_SCHEMA_VERSION].includes(Number(metadata.schemaVersion)) ||
    typeof metadata.requestKey !== "string" ||
    !content ||
    !Array.isArray(metadata.history)
  ) return null;

  const history: ExamRequestHistoryEntry[] = [];
  for (const value of metadata.history) {
    const entry = objectValue(value);
    const entryContent = parseContent(entry?.content);
    if (
      !entry ||
      typeof entry.revision !== "number" ||
      !Number.isSafeInteger(entry.revision) ||
      entry.revision < 1 ||
      !["CREATED", "UPDATED", "ISSUED"].includes(String(entry.action)) ||
      typeof entry.occurredAt !== "string" ||
      typeof entry.actorUserId !== "string" ||
      typeof entry.actorName !== "string" ||
      !entryContent
    ) return null;
    history.push({
      revision: entry.revision,
      action: entry.action as ExamRequestHistoryAction,
      occurredAt: entry.occurredAt,
      actorUserId: entry.actorUserId,
      actorName: entry.actorName,
      content: entryContent,
    });
  }
  if (metadata.issuedAt !== undefined && typeof metadata.issuedAt !== "string") return null;
  if (metadata.issuedByUserId !== undefined && typeof metadata.issuedByUserId !== "string") return null;
  const issuedSnapshot = metadata.issuedSnapshot === undefined
    ? undefined
    : parseIssuedSnapshot(metadata.issuedSnapshot);
  if (metadata.issuedSnapshot !== undefined && !issuedSnapshot) return null;

  return {
    schemaVersion: EXAM_REQUEST_SCHEMA_VERSION,
    requestKey: metadata.requestKey,
    content,
    history,
    ...(metadata.issuedAt ? { issuedAt: metadata.issuedAt as string } : {}),
    ...(metadata.issuedByUserId ? { issuedByUserId: metadata.issuedByUserId as string } : {}),
    ...(issuedSnapshot ? { issuedSnapshot } : {}),
  };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function catalogMetadata(value: unknown) {
  const metadata = objectValue(value);
  const attributes = objectValue(metadata?.attributes);
  const storedSynonyms = Array.isArray(metadata?.synonyms)
    ? metadata.synonyms
    : attributes?.synonyms;
  const synonyms = Array.isArray(storedSynonyms)
    ? storedSynonyms.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  const storedCategory = typeof metadata?.category === "string"
    ? metadata.category
    : attributes?.category;
  return {
    category: typeof storedCategory === "string" && storedCategory.trim()
      ? storedCategory.trim()
      : "Outros exames",
    synonyms,
  };
}

const rowSelect = {
  id: true,
  masterRecordId: true,
  title: true,
  version: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  masterRecord: {
    select: {
      patient: {
        select: { id: true, clinicalCode: true, fullName: true, birthDate: true, cpf: true },
      },
    },
  },
} as const;

type ExamRequestRow = Prisma.DeliverableGetPayload<{ select: typeof rowSelect }>;

async function viewFromRow(row: ExamRequestRow): Promise<ExamRequestView | null> {
  if (row.status !== "DRAFT" && row.status !== "PUBLISHED") return null;
  const metadata = parseExamRequestMetadata(row.metadata);
  if (!metadata) return null;
  const professionalUserId = metadata.issuedByUserId ?? row.createdBy.id;
  const fallbackName = metadata.history.findLast(
    (entry) => entry.actorUserId === professionalUserId,
  )?.actorName ?? row.createdBy.fullName;
  const professional = await physicalDocumentProfessionalIdentity(
    professionalUserId,
    fallbackName,
  );
  const crnRegistration = professional.registrations.find((registration) => /^CRN(?:\b|[- ])/iu.test(registration));
  const nutritionTitle = crnRegistration || /nutricionista/iu.test(professional.title ?? "")
    ? "Nutricionista"
    : undefined;
  return {
    id: row.id,
    masterRecordId: row.masterRecordId,
    status: row.status,
    version: row.version,
    title: row.title,
    content: metadata.content,
    history: metadata.history,
    patient: {
      id: row.masterRecord.patient.id,
      clinicalCode: row.masterRecord.patient.clinicalCode,
      fullName: row.masterRecord.patient.fullName,
      birthDate: row.masterRecord.patient.birthDate.toISOString().slice(0, 10),
      ...(row.masterRecord.patient.cpf ? { cpf: row.masterRecord.patient.cpf } : {}),
    },
    responsibleProfessional: {
      userId: professional.userId,
      fullName: professional.fullName,
      title: professional.title,
      registrations: professional.registrations,
      nutritionTitle,
      crnRegistration,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    issuedAt: metadata.issuedAt,
    issuedSnapshot: metadata.issuedSnapshot,
  };
}

async function actor(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE", deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!user) throw new Error("EXAM_REQUEST_ACTOR_NOT_FOUND");
  return user;
}

export const examRequestRepository = {
  async getPatient(patientId: string): Promise<ExamRequestPatientOption | null> {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        status: "ACTIVE",
        deletedAt: null,
        masterRecord: { is: { status: "ACTIVE" } },
      },
      select: { id: true, clinicalCode: true, fullName: true, birthDate: true, cpf: true },
    });
    return patient ? {
      id: patient.id,
      clinicalCode: patient.clinicalCode,
      fullName: patient.fullName,
      birthDate: patient.birthDate.toISOString().slice(0, 10),
      ...(patient.cpf ? { cpf: patient.cpf } : {}),
    } : null;
  },

  async listCatalog(): Promise<readonly ExamCatalogItem[]> {
    const records = await prisma.scientificLibraryRecord.findMany({
      where: {
        domain: "LABORATORY_EXAM",
        editorialStatus: { notIn: ["ARCHIVED", "REJECTED", "SUPERSEDED"] },
        status: { not: "INACTIVE" },
      },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: 250,
      select: { id: true, name: true, metadata: true },
    });
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      ...catalogMetadata(record.metadata),
      source: "PERSISTED" as const,
    }));
  },

  async searchPatients(query?: string): Promise<readonly ExamRequestPatientOption[]> {
    const search = query?.trim().slice(0, 180);
    const patients = await prisma.patient.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        masterRecord: { is: { status: "ACTIVE" } },
        ...(search ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { clinicalCode: { contains: search.toUpperCase() } },
          ],
        } : {}),
      },
      orderBy: [{ fullName: "asc" }, { clinicalCode: "asc" }],
      take: 30,
      select: { id: true, clinicalCode: true, fullName: true },
    });
    return patients;
  },

  async listForPatient(patientId: string): Promise<readonly ExamRequestView[]> {
    const rows = await prisma.deliverable.findMany({
      where: {
        kind: EXAM_REQUEST_KIND,
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { status: "ACTIVE", deletedAt: null },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: rowSelect,
    });
    const views = await Promise.all(rows.map(viewFromRow));
    return views.filter((item): item is ExamRequestView => Boolean(item));
  },

  async get(patientId: string, requestId: string): Promise<ExamRequestView | null> {
    const row = await prisma.deliverable.findFirst({
      where: {
        id: requestId,
        kind: EXAM_REQUEST_KIND,
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { status: "ACTIVE", deletedAt: null },
        },
      },
      select: rowSelect,
    });
    return row ? viewFromRow(row) : null;
  },

  async createDraft(input: {
    readonly patientId: string;
    readonly actorUserId: string;
    readonly content: ExamRequestContent;
  }): Promise<ExamRequestView> {
    const currentActor = await actor(input.actorUserId);
    const now = new Date().toISOString();
    const row = await prisma.$transaction(async (transaction) => {
      const [record, module, latest] = await Promise.all([
        transaction.masterRecord.findFirst({
          where: {
            patientId: input.patientId,
            status: "ACTIVE",
            patient: { status: "ACTIVE", deletedAt: null },
          },
          select: { id: true },
        }),
        transaction.systemModule.findUnique({
          where: { key: "DELIVERABLES" },
          select: { id: true },
        }),
        transaction.deliverable.findFirst({
          where: { kind: EXAM_REQUEST_KIND, masterRecord: { patientId: input.patientId } },
          orderBy: { version: "desc" },
          select: { version: true },
        }),
      ]);
      if (!record) throw new Error("EXAM_REQUEST_PATIENT_NOT_FOUND");
      if (!module) throw new Error("DELIVERABLES_MODULE_NOT_FOUND");
      const metadata: ExamRequestMetadata = {
        schemaVersion: EXAM_REQUEST_SCHEMA_VERSION,
        requestKey: randomUUID(),
        content: input.content,
        history: [{
          revision: 1,
          action: "CREATED",
          occurredAt: now,
          actorUserId: currentActor.id,
          actorName: currentActor.fullName,
          content: input.content,
        }],
      };
      return transaction.deliverable.create({
        data: {
          masterRecordId: record.id,
          moduleId: module.id,
          createdByUserId: currentActor.id,
          updatedByUserId: currentActor.id,
          kind: EXAM_REQUEST_KIND,
          title: "Solicitação de exames",
          version: (latest?.version ?? 0) + 1,
          status: "DRAFT",
          metadata: asJson(metadata),
        },
        select: rowSelect,
      });
    });
    const view = await viewFromRow(row);
    if (!view) throw new Error("EXAM_REQUEST_PERSISTENCE_FAILED");
    return view;
  },

  async revise(input: {
    readonly patientId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly content: ExamRequestContent;
    readonly issue: boolean;
  }): Promise<ExamRequestView> {
    const currentActor = await actor(input.actorUserId);
    const issuingProfessional = input.issue
      ? await physicalDocumentProfessionalIdentity(currentActor.id, currentActor.fullName)
      : undefined;
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.deliverable.findFirst({
        where: {
          id: input.requestId,
          kind: EXAM_REQUEST_KIND,
          status: "DRAFT",
          deletedAt: null,
          masterRecord: { patientId: input.patientId, status: "ACTIVE" },
        },
        select: {
          id: true,
          version: true,
          masterRecordId: true,
          metadata: true,
          masterRecord: {
            select: {
              patient: {
                select: { id: true, clinicalCode: true, fullName: true, birthDate: true, cpf: true },
              },
            },
          },
        },
      });
      if (!current) throw new Error("EXAM_REQUEST_DRAFT_NOT_FOUND");
      const metadata = parseExamRequestMetadata(current.metadata);
      if (!metadata) throw new Error("EXAM_REQUEST_INVALID_METADATA");
      const latest = await transaction.deliverable.findFirst({
        where: { masterRecordId: current.masterRecordId, kind: EXAM_REQUEST_KIND },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const occurredAt = new Date().toISOString();
      const revision = (metadata.history.at(-1)?.revision ?? 0) + 1;
      const crnRegistration = issuingProfessional?.registrations.find(
        (registration) => /^CRN(?:\b|[- ])/iu.test(registration),
      );
      const issuedSnapshot: ExamRequestIssuedSnapshot | undefined = input.issue && issuingProfessional
        ? {
            patient: {
              id: current.masterRecord.patient.id,
              clinicalCode: current.masterRecord.patient.clinicalCode,
              fullName: current.masterRecord.patient.fullName,
              birthDate: current.masterRecord.patient.birthDate.toISOString().slice(0, 10),
            },
            professional: {
              fullName: issuingProfessional.fullName,
              ...((crnRegistration || /nutricionista/iu.test(issuingProfessional.title ?? ""))
                ? { nutritionTitle: "Nutricionista" }
                : {}),
              ...(crnRegistration ? { crnRegistration } : {}),
            },
            institution: clinicInstitutionalDocumentIdentity(),
          }
        : undefined;
      const nextMetadata: ExamRequestMetadata = {
        ...metadata,
        schemaVersion: EXAM_REQUEST_SCHEMA_VERSION,
        content: input.content,
        history: [...metadata.history, {
          revision,
          action: input.issue ? "ISSUED" : "UPDATED",
          occurredAt,
          actorUserId: currentActor.id,
          actorName: currentActor.fullName,
          content: input.content,
        }],
        ...(input.issue ? {
          issuedAt: occurredAt,
          issuedByUserId: currentActor.id,
          ...(issuedSnapshot ? { issuedSnapshot } : {}),
        } : {}),
      };
      const updated = await transaction.deliverable.updateMany({
        where: { id: current.id, version: current.version, status: "DRAFT" },
        data: {
          version: (latest?.version ?? current.version) + 1,
          status: input.issue ? "PUBLISHED" : "DRAFT",
          updatedByUserId: currentActor.id,
          metadata: asJson(nextMetadata),
        },
      });
      if (updated.count !== 1) throw new Error("EXAM_REQUEST_EDIT_CONFLICT");
    });
    const view = await this.get(input.patientId, input.requestId);
    if (!view) throw new Error("EXAM_REQUEST_PERSISTENCE_FAILED");
    return view;
  },
};
