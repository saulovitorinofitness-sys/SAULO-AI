import { Badge, Button, Card, PageState } from "@/components/ui";
import type {
  ScientificLibraryEvidenceCategory,
  ScientificLibraryItem,
  ScientificLibraryPublicationType,
} from "@/features/scientific-library/contracts";
import { scientificLibraryDomainLabels } from "@/features/scientific-library/labels";

type EditorialBadge = {
  readonly label: string;
  readonly tone: "success" | "neutral" | "warning" | "info" | "danger";
};

const scientificLibraryDetailsId = "scientific-library-details";

function selectAndRevealDetails(id: string, onSelect: (id: string) => void) {
  onSelect(id);
  window.requestAnimationFrame(() => {
    const details = document.getElementById(scientificLibraryDetailsId);
    if (!details) return;
    details.scrollTo({ behavior: "smooth", top: 0 });
    details.focus({ preventScroll: true });
  });
}

const publicationTypeLabels: Readonly<
  Record<ScientificLibraryPublicationType, string>
> = {
  GUIDELINE_OR_CONSENSUS: "Diretriz ou consenso",
  SYSTEMATIC_REVIEW_META_ANALYSIS: "Revisão sistemática ou meta-análise",
  CLINICAL_TRIAL: "Ensaio clínico",
  OBSERVATIONAL_STUDY: "Estudo observacional",
  DIAGNOSTIC_STUDY: "Estudo diagnóstico",
  BIOMECHANICAL_STUDY: "Estudo biomecânico",
  TECHNICAL_BOOK_OR_MANUAL: "Livro ou manual técnico",
  OFFICIAL_DATABASE: "Base oficial",
  PROFESSIONAL_PROTOCOL: "Protocolo profissional",
  OTHER: "Outro",
  UNCLASSIFIED: "Não classificado",
};

const evidenceCategoryLabels: Readonly<
  Record<ScientificLibraryEvidenceCategory, string>
> = {
  GUIDELINE_OR_CONSENSUS: "Diretriz ou consenso",
  SYSTEMATIC_REVIEW_META_ANALYSIS: "Revisão sistemática ou meta-análise",
  CLINICAL_TRIAL: "Ensaio clínico",
  OBSERVATIONAL_STUDY: "Estudo observacional",
  DIAGNOSTIC_STUDY: "Estudo diagnóstico",
  BIOMECHANICAL_STUDY: "Estudo biomecânico",
  TECHNICAL_REFERENCE: "Referência técnica",
  OFFICIAL_DATABASE: "Base oficial",
  PROFESSIONAL_EXPERIENCE: "Experiência profissional",
  UNCLASSIFIED: "Não classificado",
};

const operationalBadges = {
  DRAFT: { label: "RASCUNHO OPERACIONAL", tone: "neutral" },
  REVIEW: { label: "EM REVISÃO OPERACIONAL", tone: "warning" },
  ACTIVE: { label: "ATIVO OPERACIONALMENTE", tone: "info" },
  INACTIVE: { label: "INATIVO OPERACIONALMENTE", tone: "neutral" },
} as const;

function isUnvalidatedContent(item: ScientificLibraryItem) {
  return (
    item.dataNature === "DEMONSTRATIVE" ||
    item.dataNature === "LEGACY" ||
    item.originKind === "MOCK" ||
    item.storageKind === "MOCK" ||
    item.storageKind === "LOCAL_FALLBACK" ||
    (!item.dataNature && !item.storageKind && !item.originKind)
  );
}

function editorialBadgeFor(item: ScientificLibraryItem): EditorialBadge {
  if (item.dataNature === "LEGACY") {
    return { label: "LEGADO — NÃO VALIDADO", tone: "neutral" };
  }
  if (isUnvalidatedContent(item)) {
    return { label: "DEMONSTRATIVO — NÃO VALIDADO", tone: "info" };
  }
  if (item.editorialStatus === "DRAFT") {
    return { label: "RASCUNHO EDITORIAL", tone: "neutral" };
  }
  if (item.editorialStatus === "UNDER_REVIEW") {
    return { label: "EM REVISÃO", tone: "warning" };
  }
  if (item.editorialStatus === "APPROVED") {
    return { label: "APROVADO", tone: "success" };
  }
  if (item.editorialStatus === "REJECTED") {
    return { label: "REJEITADO", tone: "danger" };
  }
  if (item.editorialStatus === "SUPERSEDED") {
    return { label: "SUBSTITUÍDO", tone: "neutral" };
  }
  if (item.editorialStatus === "ARCHIVED") {
    return { label: "ARQUIVADO", tone: "neutral" };
  }
  return { label: "STATUS EDITORIAL NÃO INFORMADO", tone: "neutral" };
}

function provenanceLabel(item: ScientificLibraryItem) {
  const natureLabels = {
    SCIENTIFIC: "Natureza científica",
    OFFICIAL_DATABASE: "Base oficial",
    PROFESSIONAL_PROTOCOL: "Protocolo profissional",
    OPERATIONAL: "Operacional",
    DEMONSTRATIVE: "Demonstrativo",
    LEGACY: "Legado",
  } as const;
  const storageLabels = {
    PERSISTED: "Persistido",
    SHARED_DATA: "Dados compartilhados",
    LOCAL_FALLBACK: "Fallback local",
    MOCK: "Mock",
  } as const;
  const legacyOriginLabels = {
    MOCK: "Mock",
    MANUAL: "Cadastro manual",
    IMPORT: "Importação",
    EXTERNAL: "Fonte externa",
  } as const;
  const nature = item.dataNature
    ? natureLabels[item.dataNature]
    : "Natureza não informada";
  const storage = item.storageKind
    ? storageLabels[item.storageKind]
    : item.originKind
      ? legacyOriginLabels[item.originKind]
      : "Origem não informada";
  return `${nature} · ${storage}`;
}

function scientificClassification(item: ScientificLibraryItem) {
  const legacyReference = item.references?.[0];
  const publicationType = item.publicationType ?? legacyReference?.publicationType;
  const evidenceCategory =
    item.evidenceCategory ??
    legacyReference?.evidenceCategory ??
    legacyReference?.evidenceLevel;
  const usingLegacyPublicationType =
    !item.publicationType && Boolean(legacyReference?.publicationType);
  const usingLegacyEvidenceCategory =
    !item.evidenceCategory &&
    Boolean(legacyReference?.evidenceCategory ?? legacyReference?.evidenceLevel);

  return {
    publicationType: publicationType
      ? `Tipo de publicação${usingLegacyPublicationType ? " (referência legada)" : ""}: ${publicationTypeLabels[publicationType]}`
      : undefined,
    evidenceCategory: evidenceCategory
      ? `Categoria de evidência${usingLegacyEvidenceCategory ? " (referência legada)" : ""}: ${evidenceCategoryLabels[evidenceCategory]}`
      : undefined,
  };
}

function referenceSummary(item: ScientificLibraryItem) {
  const reference = item.references?.[0];
  const referenceIsRequired =
    item.dataNature === "SCIENTIFIC" || item.editorialStatus === "APPROVED";
  if (!reference) {
    return referenceIsRequired ? "Referência: Não informado" : undefined;
  }
  const identifier = reference.doi
    ? `DOI ${reference.doi}`
    : reference.pmid
      ? `PMID ${reference.pmid}`
      : reference.isbn
        ? `ISBN ${reference.isbn}`
        : undefined;
  const title =
    reference.title ?? reference.fullCitation ?? reference.sourceTitle;
  const authors =
    reference.authors ??
    (!reference.institutionOrJournal
      ? reference.authorsOrInstitution
      : undefined);
  const institution = reference.institutionOrJournal;
  const details = [title, authors, institution, reference.publicationYear, identifier].filter(
    (entry): entry is string | number => entry !== undefined && entry !== "",
  );
  return details.length
    ? `Referência: ${details.join(" · ")}`
    : referenceIsRequired
      ? "Referência: Não informado"
      : undefined;
}

export function ScientificLibraryList({
  items,
  favorites,
  selectedId,
  onSelect,
  onToggleFavorite,
}: {
  items: readonly ScientificLibraryItem[];
  favorites: ReadonlySet<string>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <PageState
        description="Ajuste a busca, o domínio ou o filtro de favoritos."
        title="Nenhum item encontrado"
      />
    );
  }
  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:grid-cols-1 xl:self-start xl:overflow-y-scroll xl:overscroll-contain xl:pr-2 xl:[scrollbar-gutter:stable]"
      role="list"
    >
      {items.map((item) => {
        const favorite = favorites.has(item.id);
        const editorialBadge = editorialBadgeFor(item);
        const operationalBadge = item.status
          ? operationalBadges[item.status]
          : undefined;
        const classification = scientificClassification(item);
        const reference = referenceSummary(item);
        return (
          <li key={item.id}>
            <Card
              className={`h-full p-4 ${
                selectedId === item.id ? "ring-2 ring-[var(--focus)]" : ""
              }`}
              variant="interactive"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{scientificLibraryDomainLabels[item.domain]}</Badge>
                    <Badge tone="neutral">{provenanceLabel(item)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 font-black text-[var(--text-primary)]">
                      {item.name}
                    </h3>
                    <Badge tone={editorialBadge.tone}>{editorialBadge.label}</Badge>
                    {operationalBadge ? (
                      <Badge tone={operationalBadge.tone}>
                        {operationalBadge.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-bold text-[var(--muted)]">{item.category}</p>
                </div>
                <button
                  aria-label={favorite ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
                  aria-pressed={favorite}
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--line)] text-lg text-amber-600 hover:bg-amber-50"
                  onClick={() => onToggleFavorite(item.id)}
                  type="button"
                >
                  <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
                </button>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{item.description}</p>
              {classification.publicationType ||
              classification.evidenceCategory ? (
                <dl className="mt-2 grid gap-1 text-xs leading-5 text-[var(--muted)]">
                  {classification.publicationType ? (
                    <div>
                      <dt className="sr-only">Tipo de publicação</dt>
                      <dd>{classification.publicationType}</dd>
                    </div>
                  ) : null}
                  {classification.evidenceCategory ? (
                    <div>
                      <dt className="sr-only">Categoria de evidência</dt>
                      <dd>{classification.evidenceCategory}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {reference ? (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                  {reference}
                </p>
              ) : null}
              <Button
                aria-controls={scientificLibraryDetailsId}
                aria-expanded={selectedId === item.id}
                className="mt-4"
                onClick={() => selectAndRevealDetails(item.id, onSelect)}
                size="small"
                variant="outline"
              >
                Ver detalhes
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
