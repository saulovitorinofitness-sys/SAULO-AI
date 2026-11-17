import { randomUUID } from "node:crypto";

import {
  clinicInstitutionalDocumentIdentity,
  type InstitutionalDocumentIdentity,
} from "@/config/institution";
import type { Prisma } from "@/generated/prisma/client";
import { physicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";
import { prisma } from "@/lib/database/prisma";

import {
  HERBAL_PRESCRIPTION_KIND,
  HERBAL_PRESCRIPTION_SCHEMA_VERSION,
  PRESCRIPTION_ITEM_CATEGORIES,
  type HerbalPrescriptionComponent,
  type HerbalPrescriptionContent,
  type HerbalPrescriptionHistoryAction,
  type HerbalPrescriptionHistoryEntry,
  type HerbalPrescriptionIssuedSnapshot,
  type HerbalPrescriptionItem,
  type HerbalPrescriptionMetadata,
  type HerbalPrescriptionPatientOption,
  type HerbalPrescriptionView,
} from "./contracts";
import { herbalPrescriptionDocumentTitle } from "./presentation";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseComponent(value: unknown): HerbalPrescriptionComponent | null {
  const component = objectValue(value);
  if (!component || typeof component.identification !== "string") return null;
  for (const key of ["scientificName", "plantPart", "concentrationStandardization"] as const) {
    if (component[key] !== undefined && typeof component[key] !== "string") return null;
  }
  return {
    identification: component.identification,
    ...(optionalString(component.scientificName) ? { scientificName: component.scientificName as string } : {}),
    ...(optionalString(component.plantPart) ? { plantPart: component.plantPart as string } : {}),
    ...(optionalString(component.concentrationStandardization) ? { concentrationStandardization: component.concentrationStandardization as string } : {}),
  };
}

function parseItem(value: unknown): HerbalPrescriptionItem | null {
  const item = objectValue(value);
  if (!item || typeof item.identification !== "string" || !Array.isArray(item.components)) return null;
  for (const key of [
    "scientificName",
    "plantPart",
    "presentation",
    "concentrationStandardization",
    "dose",
    "route",
    "frequency",
    "duration",
    "quantity",
    "orientations",
  ] as const) {
    if (item[key] !== undefined && typeof item[key] !== "string") return null;
  }
  const components = item.components.map(parseComponent);
  if (components.some((component) => !component)) return null;
  return {
    category: typeof item.category === "string" && PRESCRIPTION_ITEM_CATEGORIES.includes(item.category as (typeof PRESCRIPTION_ITEM_CATEGORIES)[number])
      ? item.category as HerbalPrescriptionItem["category"]
      : "HERBAL",
    identification: item.identification,
    ...(optionalString(item.scientificName) ? { scientificName: item.scientificName as string } : {}),
    ...(optionalString(item.plantPart) ? { plantPart: item.plantPart as string } : {}),
    ...(optionalString(item.presentation) ? { presentation: item.presentation as string } : {}),
    ...(optionalString(item.concentrationStandardization) ? { concentrationStandardization: item.concentrationStandardization as string } : {}),
    ...(optionalString(item.dose) ? { dose: item.dose as string } : {}),
    ...(optionalString(item.route) ? { route: item.route as string } : {}),
    ...(optionalString(item.frequency) ? { frequency: item.frequency as string } : {}),
    ...(optionalString(item.duration) ? { duration: item.duration as string } : {}),
    ...(optionalString(item.quantity) ? { quantity: item.quantity as string } : {}),
    ...(optionalString(item.orientations) ? { orientations: item.orientations as string } : {}),
    components: components as HerbalPrescriptionComponent[],
  };
}

function parseContent(value: unknown): HerbalPrescriptionContent | null {
  const content = objectValue(value);
  if (!content || !Array.isArray(content.items)) return null;
  const items = content.items.map(parseItem);
  if (items.some((item) => !item)) return null;
  return { items: items as HerbalPrescriptionItem[] };
}

function parseInstitution(value: unknown): InstitutionalDocumentIdentity | null {
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
  const contacts = identity.contacts.map(objectValue);
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
    contacts: contacts.map((contact) => ({
      label: contact!.label as string,
      value: contact!.value as string,
    })),
  };
}

function parseIssuedSnapshot(value: unknown): HerbalPrescriptionIssuedSnapshot | null {
  const snapshot = objectValue(value);
  const patient = objectValue(snapshot?.patient);
  const professional = objectValue(snapshot?.professional);
  const institution = parseInstitution(snapshot?.institution);
  if (
    !snapshot || !patient || !professional || !institution ||
    typeof patient.id !== "string" ||
    typeof patient.clinicalCode !== "string" ||
    typeof patient.fullName !== "string" ||
    typeof patient.birthDate !== "string" ||
    typeof professional.fullName !== "string" ||
    (professional.nutritionTitle !== undefined && typeof professional.nutritionTitle !== "string") ||
    (professional.crnRegistration !== undefined && typeof professional.crnRegistration !== "string")
  ) return null;
  return {
    patient: {
      id: patient.id,
      clinicalCode: patient.clinicalCode,
      fullName: patient.fullName,
      birthDate: patient.birthDate,
    },
    professional: {
      fullName: professional.fullName,
      ...(optionalString(professional.nutritionTitle) ? { nutritionTitle: professional.nutritionTitle as string } : {}),
      ...(optionalString(professional.crnRegistration) ? { crnRegistration: professional.crnRegistration as string } : {}),
    },
    institution,
  };
}

export function parseHerbalPrescriptionMetadata(value: unknown): HerbalPrescriptionMetadata | null {
  const metadata = objectValue(value);
  const content = parseContent(metadata?.content);
  if (
    !metadata ||
    (metadata.schemaVersion !== 1 && metadata.schemaVersion !== HERBAL_PRESCRIPTION_SCHEMA_VERSION) ||
    typeof metadata.prescriptionKey !== "string" ||
    !content ||
    !Array.isArray(metadata.history)
  ) return null;
  const history: HerbalPrescriptionHistoryEntry[] = [];
  for (const value of metadata.history) {
    const entry = objectValue(value);
    const entryContent = parseContent(entry?.content);
    if (
      !entry || !entryContent ||
      typeof entry.revision !== "number" ||
      !Number.isSafeInteger(entry.revision) || entry.revision < 1 ||
      !["CREATED", "UPDATED", "ISSUED"].includes(String(entry.action)) ||
      typeof entry.occurredAt !== "string" ||
      typeof entry.actorUserId !== "string" ||
      typeof entry.actorName !== "string"
    ) return null;
    history.push({
      revision: entry.revision,
      action: entry.action as HerbalPrescriptionHistoryAction,
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
    schemaVersion: metadata.schemaVersion,
    prescriptionKey: metadata.prescriptionKey,
    content,
    history,
    ...(metadata.issuedAt ? { issuedAt: metadata.issuedAt } : {}),
    ...(metadata.issuedByUserId ? { issuedByUserId: metadata.issuedByUserId } : {}),
    ...(issuedSnapshot ? { issuedSnapshot } : {}),
  };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
  masterRecord: {
    select: {
      patient: {
        select: { id: true, clinicalCode: true, fullName: true, birthDate: true },
      },
    },
  },
} as const;

type HerbalPrescriptionRow = Prisma.DeliverableGetPayload<{ select: typeof rowSelect }>;

async function viewFromRow(row: HerbalPrescriptionRow): Promise<HerbalPrescriptionView | null> {
  if (row.status !== "DRAFT" && row.status !== "PUBLISHED") return null;
  const metadata = parseHerbalPrescriptionMetadata(row.metadata);
  if (!metadata) return null;
  const professionalUserId = metadata.issuedByUserId ?? row.createdBy.id;
  const fallbackName = metadata.history.findLast(
    (entry) => entry.actorUserId === professionalUserId,
  )?.actorName ?? row.createdBy.fullName;
  const professional = await physicalDocumentProfessionalIdentity(professionalUserId, fallbackName);
  const crnRegistration = professional.registrations.find(
    (registration) => /^CRN(?:\b|[- ])/iu.test(registration),
  );
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
    },
    responsibleProfessional: {
      userId: professional.userId,
      fullName: professional.fullName,
      ...((crnRegistration || /nutricionista/iu.test(professional.title ?? "")) ? { nutritionTitle: "Nutricionista" } : {}),
      ...(crnRegistration ? { crnRegistration } : {}),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(metadata.issuedAt ? { issuedAt: metadata.issuedAt } : {}),
    ...(metadata.issuedSnapshot ? { issuedSnapshot: metadata.issuedSnapshot } : {}),
  };
}

async function actor(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE", deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!user) throw new Error("HERBAL_PRESCRIPTION_ACTOR_NOT_FOUND");
  return user;
}

export const herbalPrescriptionRepository = {
  async getPatient(patientId: string): Promise<HerbalPrescriptionPatientOption | null> {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        status: "ACTIVE",
        deletedAt: null,
        masterRecord: { is: { status: "ACTIVE" } },
      },
      select: { id: true, clinicalCode: true, fullName: true, birthDate: true },
    });
    return patient ? {
      id: patient.id,
      clinicalCode: patient.clinicalCode,
      fullName: patient.fullName,
      birthDate: patient.birthDate.toISOString().slice(0, 10),
    } : null;
  },

  async searchPatients(query?: string): Promise<readonly HerbalPrescriptionPatientOption[]> {
    const search = query?.trim().slice(0, 180);
    return prisma.patient.findMany({
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
  },

  async listForPatient(patientId: string): Promise<readonly HerbalPrescriptionView[]> {
    const rows = await prisma.deliverable.findMany({
      where: {
        kind: HERBAL_PRESCRIPTION_KIND,
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
    return views.filter((item): item is HerbalPrescriptionView => Boolean(item));
  },

  async get(patientId: string, prescriptionId: string): Promise<HerbalPrescriptionView | null> {
    const row = await prisma.deliverable.findFirst({
      where: {
        id: prescriptionId,
        kind: HERBAL_PRESCRIPTION_KIND,
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
    readonly content: HerbalPrescriptionContent;
  }): Promise<HerbalPrescriptionView> {
    const currentActor = await actor(input.actorUserId);
    const occurredAt = new Date().toISOString();
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
          where: { kind: HERBAL_PRESCRIPTION_KIND, masterRecord: { patientId: input.patientId } },
          orderBy: { version: "desc" },
          select: { version: true },
        }),
      ]);
      if (!record) throw new Error("HERBAL_PRESCRIPTION_PATIENT_NOT_FOUND");
      if (!module) throw new Error("DELIVERABLES_MODULE_NOT_FOUND");
      const metadata: HerbalPrescriptionMetadata = {
        schemaVersion: HERBAL_PRESCRIPTION_SCHEMA_VERSION,
        prescriptionKey: randomUUID(),
        content: input.content,
        history: [{
          revision: 1,
          action: "CREATED",
          occurredAt,
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
          kind: HERBAL_PRESCRIPTION_KIND,
          title: herbalPrescriptionDocumentTitle(input.content),
          version: (latest?.version ?? 0) + 1,
          status: "DRAFT",
          metadata: asJson(metadata),
        },
        select: rowSelect,
      });
    });
    const view = await viewFromRow(row);
    if (!view) throw new Error("HERBAL_PRESCRIPTION_PERSISTENCE_FAILED");
    return view;
  },

  async revise(input: {
    readonly patientId: string;
    readonly prescriptionId: string;
    readonly actorUserId: string;
    readonly content: HerbalPrescriptionContent;
    readonly issue: boolean;
  }): Promise<HerbalPrescriptionView> {
    const currentActor = await actor(input.actorUserId);
    const issuingProfessional = input.issue
      ? await physicalDocumentProfessionalIdentity(currentActor.id, currentActor.fullName)
      : undefined;
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.deliverable.findFirst({
        where: {
          id: input.prescriptionId,
          kind: HERBAL_PRESCRIPTION_KIND,
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
                select: { id: true, clinicalCode: true, fullName: true, birthDate: true },
              },
            },
          },
        },
      });
      if (!current) throw new Error("HERBAL_PRESCRIPTION_DRAFT_NOT_FOUND");
      const metadata = parseHerbalPrescriptionMetadata(current.metadata);
      if (!metadata) throw new Error("HERBAL_PRESCRIPTION_INVALID_METADATA");
      const latest = await transaction.deliverable.findFirst({
        where: { masterRecordId: current.masterRecordId, kind: HERBAL_PRESCRIPTION_KIND },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const occurredAt = new Date().toISOString();
      const revision = (metadata.history.at(-1)?.revision ?? 0) + 1;
      const crnRegistration = issuingProfessional?.registrations.find(
        (registration) => /^CRN(?:\b|[- ])/iu.test(registration),
      );
      const issuedSnapshot: HerbalPrescriptionIssuedSnapshot | undefined = input.issue && issuingProfessional
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
      const nextMetadata: HerbalPrescriptionMetadata = {
        ...metadata,
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
          title: herbalPrescriptionDocumentTitle(input.content),
          version: (latest?.version ?? current.version) + 1,
          status: input.issue ? "PUBLISHED" : "DRAFT",
          updatedByUserId: currentActor.id,
          metadata: asJson(nextMetadata),
        },
      });
      if (updated.count !== 1) throw new Error("HERBAL_PRESCRIPTION_EDIT_CONFLICT");
    });
    const view = await this.get(input.patientId, input.prescriptionId);
    if (!view) throw new Error("HERBAL_PRESCRIPTION_PERSISTENCE_FAILED");
    return view;
  },
};
