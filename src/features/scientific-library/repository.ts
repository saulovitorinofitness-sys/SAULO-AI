import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import {
  SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES,
  SCIENTIFIC_LIBRARY_PUBLICATION_TYPES,
  type ScientificLibraryEvidenceCategory,
  type ScientificLibraryItem,
  type ScientificLibraryPublicationType,
} from "./contracts";
import { scientificLibraryDomainLabels } from "./labels";
import {
  normalizeScientificLibraryName,
  type ScientificLibraryDraft,
  type ScientificLibraryOrigin,
  type ScientificLibraryReferenceDraft,
} from "./management-contracts";

function nullable(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned || null;
}

function optionalNullable(value: string | undefined) {
  return value === undefined ? undefined : nullable(value);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function storedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function enumValue<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): Values[number] | undefined {
  return typeof value === "string" && values.includes(value)
    ? value as Values[number]
    : undefined;
}

type StoredReferenceDetail = {
  readonly authors?: string;
  readonly institutionOrJournal?: string;
  readonly language?: string;
  readonly notes?: string;
};

function storedMetadata(value: unknown) {
  const record = objectValue(value);
  const attributesSource = objectValue(record.attributes);
  const attributes = Object.entries(attributesSource).reduce<
    Record<string, string | string[]>
  >((result, [key, entry]) => {
    if (typeof entry === "string") result[key] = entry;
    if (Array.isArray(entry)) result[key] = stringArray(entry);
    return result;
  }, {});
  const scientific = objectValue(record.scientific);
  const referenceDetails = new Map<number, StoredReferenceDetail>();
  if (Array.isArray(scientific.referenceDetails)) {
    scientific.referenceDetails.forEach((entry, index) => {
      const detail = objectValue(entry);
      const sortOrder = Number.isInteger(detail.sortOrder)
        ? Number(detail.sortOrder)
        : index;
      referenceDetails.set(sortOrder, {
        authors: storedString(detail.authors),
        institutionOrJournal: storedString(detail.institutionOrJournal),
        language: storedString(detail.language),
        notes: storedString(detail.notes),
      });
    });
  }
  return {
    attributes,
    reusableBy: stringArray(record.reusableBy),
    publicationType: enumValue(
      SCIENTIFIC_LIBRARY_PUBLICATION_TYPES,
      scientific.publicationType,
    ) as ScientificLibraryPublicationType | undefined,
    evidenceCategory: enumValue(
      SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES,
      scientific.evidenceCategory,
    ) as ScientificLibraryEvidenceCategory | undefined,
    referenceDetails,
  };
}

function referenceFingerprint(reference: ScientificLibraryReferenceDraft) {
  if (reference.doi) return `doi:${reference.doi.toLocaleLowerCase()}`;
  if (reference.pmid) return `pmid:${reference.pmid}`;
  if (reference.isbn) return `isbn:${reference.isbn.replace(/[\s-]/g, "").toUpperCase()}`;
  if (reference.officialUrl) return `url:${reference.officialUrl}`;
  return [
    reference.sourceTitle,
    reference.authors,
    reference.institutionOrJournal,
    reference.publicationYear,
  ].map((value) => String(value ?? "").trim().toLocaleLowerCase()).join("|");
}

function prepareReferences(references: readonly ScientificLibraryReferenceDraft[] | undefined) {
  const seen = new Set<string>();
  const accepted = (references ?? []).flatMap((reference, sourceIndex) => {
    const sourceTitle = reference.sourceTitle.trim();
    if (!sourceTitle) return [];
    const fingerprint = referenceFingerprint({ ...reference, sourceTitle });
    if (seen.has(fingerprint)) return [];
    seen.add(fingerprint);
    return [{ reference: { ...reference, sourceTitle }, sourceIndex }];
  });

  return {
    create: accepted.map(({ reference, sourceIndex }, order) => ({
      sourceTitle: reference.sourceTitle,
      fullCitation: nullable(reference.fullCitation),
      authorsOrInstitution: nullable(
        [reference.authors, reference.institutionOrJournal]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(" · "),
      ),
      publicationYear: reference.publicationYear,
      doi: nullable(reference.doi),
      pmid: nullable(reference.pmid),
      isbn: nullable(reference.isbn),
      officialUrl: nullable(reference.officialUrl),
      publicationType: reference.publicationType,
      evidenceCategory: reference.evidenceCategory,
      isPrimary: order === 0,
      sortOrder: sourceIndex,
    })),
    details: accepted.map(({ reference, sourceIndex }) => ({
      sortOrder: sourceIndex,
      authors: reference.authors,
      institutionOrJournal: reference.institutionOrJournal,
      language: reference.language,
      notes: reference.notes,
    })),
  };
}

function recordMetadata(
  draft: ScientificLibraryDraft,
  currentValue?: unknown,
  referenceDetails?: readonly Record<string, unknown>[],
) {
  const current = objectValue(currentValue);
  const currentScientific = objectValue(current.scientific);
  const scientific = {
    ...currentScientific,
    publicationType:
      draft.publicationType ?? currentScientific.publicationType ?? "UNCLASSIFIED",
    evidenceCategory:
      draft.evidenceCategory ?? currentScientific.evidenceCategory ?? "UNCLASSIFIED",
    ...(referenceDetails ? { referenceDetails } : {}),
  };
  return json({
    ...current,
    attributes: draft.attributes,
    reusableBy: stringArray(current.reusableBy),
    scientific,
  });
}

function assertNotApproved(draft: ScientificLibraryDraft) {
  if (draft.editorialStatus === "APPROVED") {
    throw new Error("DIRECT_EDITORIAL_APPROVAL_NOT_ALLOWED");
  }
}

const include = {
  createdBy: { select: { fullName: true } },
  reviewedBy: { select: { fullName: true } },
  references: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  revisions: { orderBy: [{ createdAt: "asc" as const }, { version: "asc" as const }] },
} satisfies Prisma.ScientificLibraryRecordInclude;

type RecordWithRelations = Prisma.ScientificLibraryRecordGetPayload<{
  include: typeof include;
}>;

function toView(record: RecordWithRelations): ScientificLibraryItem {
  const metadata = storedMetadata(record.metadata);
  const domain = record.domain as ScientificLibraryItem["domain"];
  const hasRealReview = Boolean(
    record.reviewedAt && record.reviewedByUserId && record.reviewedBy,
  );
  const references = record.references.map((reference) => {
    const detail = metadata.referenceDetails.get(reference.sortOrder);
    return {
      id: reference.id,
      title: reference.sourceTitle ?? undefined,
      sourceTitle: reference.sourceTitle ?? undefined,
      fullCitation: reference.fullCitation ?? undefined,
      authors: detail?.authors,
      institutionOrJournal: detail?.institutionOrJournal,
      authorsOrInstitution: reference.authorsOrInstitution ?? undefined,
      publicationYear: reference.publicationYear ?? undefined,
      doi: reference.doi ?? undefined,
      pmid: reference.pmid ?? undefined,
      isbn: reference.isbn ?? undefined,
      officialUrl: reference.officialUrl ?? undefined,
      sourceVersion: reference.sourceVersion ?? undefined,
      evidenceDate: reference.evidenceDate?.toISOString(),
      accessedAt: reference.accessedAt?.toISOString(),
      publicationType: reference.publicationType,
      evidenceCategory: reference.evidenceCategory,
      evidenceLevel: reference.evidenceCategory,
      language: detail?.language,
      notes: detail?.notes,
      recommendationStrength: reference.recommendationStrength ?? undefined,
      evidenceLimitations: reference.evidenceLimitations ?? undefined,
      isPrimary: reference.isPrimary,
      sortOrder: reference.sortOrder,
      createdAt: reference.createdAt.toISOString(),
    };
  });
  return {
    id: record.id,
    area: record.area as ScientificLibraryItem["area"],
    domain,
    name: record.name,
    category: scientificLibraryDomainLabels[domain],
    description: record.description ?? "",
    source: record.source ?? "Origem manual não informada",
    tags: stringArray(record.tags),
    attributes: metadata.attributes,
    reusableBy: metadata.reusableBy,
    reviewedAt: hasRealReview ? record.reviewedAt?.toISOString() : undefined,
    reviewedBy: hasRealReview ? record.reviewedBy?.fullName : undefined,
    initiallyFavorite: false,
    status: record.status as ScientificLibraryItem["status"],
    originKind: record.originKind as ScientificLibraryItem["originKind"],
    professionalNotes: record.professionalNotes ?? undefined,
    externalCode: record.externalCode ?? undefined,
    classificationSystem: record.classificationSystem ?? undefined,
    sourceVersion: record.sourceVersion ?? undefined,
    responsibleProfessional: record.createdBy.fullName,
    createdAt: record.createdAt.toISOString(),
    importFileName: record.importFileName ?? undefined,
    storageKind: "PERSISTED",
    dataNature: record.dataNature,
    editorialStatus: record.editorialStatus,
    publicationType: metadata.publicationType,
    evidenceCategory: metadata.evidenceCategory,
    technicalContent: record.technicalContent ?? undefined,
    professionalApplication: record.professionalApplication ?? undefined,
    targetPopulation: record.targetPopulation ?? undefined,
    indications: record.indications ?? undefined,
    contraindications: record.contraindications ?? undefined,
    precautions: record.precautions ?? undefined,
    limitations: record.limitations ?? undefined,
    submittedForReviewAt: record.submittedForReviewAt?.toISOString(),
    approvedAt: record.approvedAt?.toISOString(),
    reviewedByUserId: hasRealReview ? record.reviewedByUserId ?? undefined : undefined,
    approvedByUserId: record.approvedByUserId ?? undefined,
    editorialVersion: record.editorialVersion,
    changeReason: record.changeReason ?? undefined,
    reviewNotes: record.reviewNotes ?? undefined,
    references,
    revisions: record.revisions.map((revision) => ({
      id: revision.id,
      version: revision.version,
      snapshot: revision.snapshot,
      changedByUserId: revision.changedByUserId ?? undefined,
      createdAt: revision.createdAt.toISOString(),
      changeReason: revision.changeReason ?? undefined,
      editorialStatus: revision.editorialStatus,
    })),
  };
}

function createData(input: {
  professionalUserId: string;
  draft: ScientificLibraryDraft;
  originKind: ScientificLibraryOrigin;
  importFileName?: string;
}) {
  const references = prepareReferences(input.draft.references);
  return {
    data: {
      createdByUserId: input.professionalUserId,
      updatedByUserId: input.professionalUserId,
      area: input.draft.area,
      domain: input.draft.domain,
      name: input.draft.name.trim(),
      normalizedName: normalizeScientificLibraryName(input.draft.name),
      description: nullable(input.draft.description),
      tags: json(input.draft.tags),
      source: nullable(input.draft.source),
      professionalNotes: nullable(input.draft.professionalNotes),
      status: input.draft.status,
      originKind: input.originKind,
      externalCode: nullable(input.draft.externalCode),
      classificationSystem: nullable(input.draft.classificationSystem),
      sourceVersion: nullable(input.draft.sourceVersion),
      metadata: recordMetadata(input.draft, undefined, references.details),
      importFileName: input.importFileName,
      dataNature: input.draft.dataNature ?? "DEMONSTRATIVE",
      editorialStatus: input.draft.editorialStatus ?? "DRAFT",
      technicalContent: nullable(input.draft.technicalContent),
      professionalApplication: nullable(input.draft.professionalApplication),
      targetPopulation: nullable(input.draft.targetPopulation),
      indications: nullable(input.draft.indications),
      contraindications: nullable(input.draft.contraindications),
      precautions: nullable(input.draft.precautions),
      limitations: nullable(input.draft.limitations),
      editorialVersion: input.draft.editorialVersion ?? 1,
      references: references.create.length
        ? { create: references.create }
        : undefined,
    },
    references,
  };
}

export const scientificLibraryRepository = {
  async list(professionalUserId: string) {
    const records = await prisma.scientificLibraryRecord.findMany({
      where: { createdByUserId: professionalUserId },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      include,
    });
    return records.map(toView);
  },

  async create(input: {
    professionalUserId: string;
    draft: ScientificLibraryDraft;
    originKind: ScientificLibraryOrigin;
    importFileName?: string;
  }) {
    assertNotApproved(input.draft);
    return prisma.$transaction(async (transaction) => {
      const prepared = createData(input);
      const record = await transaction.scientificLibraryRecord.create({
        data: prepared.data,
        include,
      });
      return toView(record);
    });
  },

  async updateExercise(input: {
    professionalUserId: string;
    id: string;
    draft: ScientificLibraryDraft;
  }) {
    assertNotApproved(input.draft);
    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.scientificLibraryRecord.findFirst({
        where: {
          id: input.id,
          createdByUserId: input.professionalUserId,
          domain: "EXERCISE",
          editorialStatus: { not: "APPROVED" },
        },
        select: { id: true, metadata: true },
      });
      if (!existing) return null;

      const replaceReferences = input.draft.references !== undefined;
      const references = prepareReferences(input.draft.references);
      if (replaceReferences) {
        await transaction.scientificLibraryReference.deleteMany({
          where: { recordId: existing.id },
        });
        if (references.create.length) {
          await transaction.scientificLibraryReference.createMany({
            data: references.create.map((reference) => ({
              ...reference,
              recordId: existing.id,
            })),
          });
        }
      }

      const record = await transaction.scientificLibraryRecord.update({
        where: { id: existing.id },
        data: {
          updatedByUserId: input.professionalUserId,
          area: input.draft.area,
          domain: input.draft.domain,
          name: input.draft.name.trim(),
          normalizedName: normalizeScientificLibraryName(input.draft.name),
          description: nullable(input.draft.description),
          tags: json(input.draft.tags),
          source: nullable(input.draft.source),
          professionalNotes: nullable(input.draft.professionalNotes),
          status: input.draft.status,
          externalCode: nullable(input.draft.externalCode),
          classificationSystem: nullable(input.draft.classificationSystem),
          sourceVersion: nullable(input.draft.sourceVersion),
          metadata: recordMetadata(
            input.draft,
            existing.metadata,
            replaceReferences ? references.details : undefined,
          ),
          dataNature: input.draft.dataNature,
          editorialStatus: input.draft.editorialStatus,
          technicalContent: optionalNullable(input.draft.technicalContent),
          professionalApplication: optionalNullable(input.draft.professionalApplication),
          targetPopulation: optionalNullable(input.draft.targetPopulation),
          indications: optionalNullable(input.draft.indications),
          contraindications: optionalNullable(input.draft.contraindications),
          precautions: optionalNullable(input.draft.precautions),
          limitations: optionalNullable(input.draft.limitations),
          editorialVersion: input.draft.editorialVersion,
        },
        include,
      });
      return toView(record);
    });
  },

  async createMany(input: {
    professionalUserId: string;
    drafts: readonly ScientificLibraryDraft[];
    importFileName: string;
  }) {
    input.drafts.forEach(assertNotApproved);
    return prisma.$transaction(async (transaction) => {
      const created: ScientificLibraryItem[] = [];
      let duplicates = 0;
      for (const draft of input.drafts) {
        const normalizedName = normalizeScientificLibraryName(draft.name);
        const existing = await transaction.scientificLibraryRecord.findFirst({
          where: {
            createdByUserId: input.professionalUserId,
            area: draft.area,
            domain: draft.domain,
            normalizedName,
          },
          select: { id: true },
        });
        if (existing) {
          duplicates += 1;
          continue;
        }
        const prepared = createData({
          professionalUserId: input.professionalUserId,
          draft,
          originKind: "IMPORT",
          importFileName: input.importFileName,
        });
        const record = await transaction.scientificLibraryRecord.create({
          data: prepared.data,
          include,
        });
        created.push(toView(record));
      }
      return { created, duplicates };
    });
  },
};
