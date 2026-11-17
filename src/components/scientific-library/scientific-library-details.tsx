import { Badge, Card, PageState, SectionHeader } from "@/components/ui";
import {
  parseScientificAttributeValue,
  scientificAttributeLabel,
  type ScientificAttributeValue,
} from "@/features/scientific-library/presentation";
import type {
  ScientificLibraryEditorialStatus,
  ScientificLibraryEvidenceCategory,
  ScientificLibraryItem,
  ScientificLibraryPublicationType,
  ScientificLibraryReference,
} from "@/features/scientific-library/contracts";
import { scientificLibraryDomainLabels } from "@/features/scientific-library/labels";
import { scientificLibraryStatusLabels } from "@/features/scientific-library/management-contracts";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );

const editorialStatusPresentation: Readonly<
  Record<
    ScientificLibraryEditorialStatus,
    {
      label: string;
      tone: "danger" | "neutral" | "success" | "warning";
    }
  >
> = {
  DRAFT: { label: "Rascunho editorial", tone: "neutral" },
  UNDER_REVIEW: { label: "Em revisão", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  SUPERSEDED: { label: "Substituído", tone: "neutral" },
  ARCHIVED: { label: "Arquivado", tone: "neutral" },
  REJECTED: { label: "Rejeitado", tone: "danger" },
};

const operationalStatusTones = {
  DRAFT: "neutral",
  REVIEW: "warning",
  ACTIVE: "success",
  INACTIVE: "neutral",
} as const;

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

function ScientificTextField({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value?: string;
}) {
  return (
    <div className={`rounded-[var(--radius-medium)] border border-[var(--line)] p-4 ${className}`}>
      <dt className="text-xs font-bold text-[var(--muted)]">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
        {value || <span className="text-[var(--muted)]">Não informado</span>}
      </dd>
    </div>
  );
}

function ReferenceField({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value?: string | number;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-bold text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[var(--text-primary)]">
        {value || <span className="text-[var(--muted)]">Não informado</span>}
      </dd>
    </div>
  );
}

function ScientificReferenceDetails({
  reference,
  index,
}: {
  reference: ScientificLibraryReference;
  index: number;
}) {
  const authors =
    reference.authors ??
    (!reference.institutionOrJournal
      ? reference.authorsOrInstitution
      : undefined);

  return (
    <li className="rounded-[var(--radius-medium)] border border-[var(--line)] p-4">
      <h4 className="font-black text-[var(--text-primary)]">
        Referência {index + 1}
      </h4>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <ReferenceField
          className="sm:col-span-2"
          label="Título"
          value={reference.title ?? reference.sourceTitle}
        />
        <ReferenceField label="Autores" value={authors} />
        <ReferenceField
          label="Instituição ou periódico"
          value={reference.institutionOrJournal}
        />
        <ReferenceField label="Ano" value={reference.publicationYear} />
        <ReferenceField label="DOI" value={reference.doi} />
        <ReferenceField label="PMID" value={reference.pmid} />
        <ReferenceField label="ISBN" value={reference.isbn} />
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold text-[var(--muted)]">
            URL oficial
          </dt>
          <dd className="mt-1 break-all text-sm">
            {reference.officialUrl ? (
              <a
                className="font-bold text-[var(--primary)] underline underline-offset-2"
                href={reference.officialUrl}
                rel="noreferrer"
                target="_blank"
              >
                {reference.officialUrl}
              </a>
            ) : (
              <span className="text-[var(--muted)]">Não informado</span>
            )}
          </dd>
        </div>
        <ReferenceField
          label="Tipo de publicação"
          value={publicationTypeLabels[reference.publicationType]}
        />
        <ReferenceField
          label="Categoria de evidência"
          value={evidenceCategoryLabels[reference.evidenceCategory]}
        />
        <ReferenceField label="Idioma" value={reference.language} />
        <ReferenceField
          className="sm:col-span-2"
          label="Citação bibliográfica completa"
          value={reference.fullCitation}
        />
        <ReferenceField
          className="sm:col-span-2"
          label="Observações"
          value={reference.notes}
        />
      </dl>
    </li>
  );
}

function PrimitiveValue({ value }: { value: string | number | boolean | null }) {
  if (value === null || value === "") {
    return <span className="font-medium text-[var(--muted)]">Não informado</span>;
  }
  if (typeof value === "boolean") return <>{value ? "Sim" : "Não"}</>;
  return <>{value}</>;
}

function StructuredValue({ value }: { value: ScientificAttributeValue }) {
  if (!Array.isArray(value) && (value === null || typeof value !== "object")) {
    return <PrimitiveValue value={value} />;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="grid gap-2">
        {value.map((entry, index) => (
          <li
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-3"
            key={index}
          >
            <StructuredValue value={entry} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid gap-2">
      {Object.entries(value).map(([key, entry]) => (
        <div
          className="grid gap-1 sm:grid-cols-[minmax(8rem,.45fr)_minmax(0,1fr)] sm:gap-3"
          key={key}
        >
          <dt className="text-xs font-bold text-[var(--muted)]">
            {scientificAttributeLabel(key)}
          </dt>
          <dd className="min-w-0 break-words text-sm font-bold text-[var(--text-primary)]">
            <StructuredValue value={entry} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ScientificLibraryDetails({
  item,
}: {
  item?: ScientificLibraryItem;
}) {
  if (!item) {
    return (
      <PageState
        description="Selecione um item do catálogo para conferir origem, atributos e futuros consumidores."
        title="Selecione um conhecimento"
      />
    );
  }

  const isUnvalidatedContent =
    item.dataNature === "DEMONSTRATIVE" ||
    item.dataNature === "LEGACY" ||
    item.originKind === "MOCK" ||
    item.storageKind === "MOCK" ||
    item.storageKind === "LOCAL_FALLBACK" ||
    (!item.dataNature && !item.storageKind && !item.originKind);
  const unvalidatedContentLabel =
    item.dataNature === "LEGACY"
      ? "Conteúdo legado — ainda não validado cientificamente"
      : "Conteúdo demonstrativo — ainda não validado cientificamente";
  const editorialStatus = item.editorialStatus
    ? editorialStatusPresentation[item.editorialStatus]
    : undefined;
  const reviewedBy = item.reviewedBy?.trim();
  const reviewedAt = item.reviewedAt;
  const hasRealReview = Boolean(
    reviewedBy &&
      reviewedAt &&
      item.editorialStatus !== "DRAFT" &&
      !isUnvalidatedContent,
  );
  const hasUnsubstantiatedApproval =
    item.editorialStatus === "APPROVED" && !hasRealReview;

  return (
    <Card
      aria-label={`Detalhes científicos de ${item.name}`}
      className="scroll-mt-24 p-5 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] md:p-6 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-scroll xl:overscroll-contain xl:[scrollbar-gutter:stable]"
      id="scientific-library-details"
      tabIndex={-1}
      variant="elevated"
    >
      <SectionHeader
        description={item.description}
        eyebrow={scientificLibraryDomainLabels[item.domain]}
        title={item.name}
      />
      <div className="mt-5 grid gap-4">
        {item.domain === "POSTURAL_CHANGE" ? (
          <div className="rounded-[var(--radius-medium)] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Achado/alteração observacional. Não representa diagnóstico clínico automático.
          </div>
        ) : null}
        {item.domain === "POSTURAL_CONDITION" ? (
          <div className="rounded-[var(--radius-medium)] border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">
            Condição ou diagnóstico associado registrado separadamente. Não foi inferido a partir de achado postural.
          </div>
        ) : null}
        {isUnvalidatedContent ? (
          <div
            className="rounded-[var(--radius-medium)] border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900"
            role="status"
          >
            {unvalidatedContentLabel}. Este item não representa conteúdo
            cientificamente aprovado.
          </div>
        ) : null}
        <div className="rounded-[var(--radius-medium)] border border-[var(--line)] p-4">
          <div className="flex flex-wrap gap-2">
            {item.status ? (
              <Badge
                tone={
                  item.status === "ACTIVE" &&
                  (isUnvalidatedContent || item.editorialStatus === "DRAFT")
                    ? "info"
                    : operationalStatusTones[item.status]
                }
              >
                Status operacional: {scientificLibraryStatusLabels[item.status]}
              </Badge>
            ) : null}
            {editorialStatus &&
            !isUnvalidatedContent &&
            !hasUnsubstantiatedApproval ? (
              <Badge tone={editorialStatus.tone}>
                Status editorial: {editorialStatus.label}
              </Badge>
            ) : null}
            {editorialStatus &&
            isUnvalidatedContent &&
            item.editorialStatus !== "APPROVED" ? (
              <Badge tone={editorialStatus.tone}>
                Status editorial: {editorialStatus.label}
              </Badge>
            ) : null}
            {hasUnsubstantiatedApproval && !isUnvalidatedContent ? (
              <Badge tone="neutral">
                Status editorial inconsistente — revisão não comprovada
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 text-sm text-[var(--text-secondary)]">
            {hasRealReview && reviewedBy && reviewedAt ? (
              <p>
                Revisado por{" "}
                <strong className="text-[var(--text-primary)]">
                  {reviewedBy}
                </strong>{" "}
                em {formatDate(reviewedAt)}.
              </p>
            ) : (
              <p className="font-black text-[var(--text-primary)]">
                Ainda não revisado
              </p>
            )}
            {item.status === "ACTIVE" &&
            item.editorialStatus === "DRAFT" ? (
              <p className="mt-1">
                Ativo operacionalmente; ainda não revisado cientificamente.
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
          <p className="text-xs font-bold text-[var(--muted)]">Origem</p>
          <p className="mt-1 font-black text-[var(--text-primary)]">
            {item.source}
          </p>
          {item.sourceSharedDataId ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Referência única: {item.sourceSharedDataId}
            </p>
          ) : null}
        </div>
        {item.status || item.originKind ? (
          <dl className="grid gap-3 rounded-[var(--radius-medium)] border border-[var(--line)] p-4 sm:grid-cols-2">
            {item.status ? <div><dt className="text-xs font-bold text-[var(--muted)]">Status operacional</dt><dd className="mt-1 text-sm font-black">{scientificLibraryStatusLabels[item.status]}</dd></div> : null}
            {item.originKind ? <div><dt className="text-xs font-bold text-[var(--muted)]">Origem do cadastro</dt><dd className="mt-1 text-sm font-black">{item.originKind === "MANUAL" ? "Cadastro manual" : item.originKind === "IMPORT" ? "Importação" : item.originKind === "EXTERNAL" ? "Fonte externa" : "Dado demonstrativo"}</dd></div> : null}
            {item.responsibleProfessional ? <div><dt className="text-xs font-bold text-[var(--muted)]">Profissional responsável</dt><dd className="mt-1 text-sm font-black">{item.responsibleProfessional}</dd></div> : null}
            {item.createdAt ? <div><dt className="text-xs font-bold text-[var(--muted)]">Criado em</dt><dd className="mt-1 text-sm font-black">{formatDate(item.createdAt)}</dd></div> : null}
            {item.importFileName ? <div className="sm:col-span-2"><dt className="text-xs font-bold text-[var(--muted)]">Arquivo de origem</dt><dd className="mt-1 break-words text-sm font-black">{item.importFileName}</dd></div> : null}
          </dl>
        ) : null}
        {item.externalCode || item.classificationSystem || item.sourceVersion ? (
          <dl className="grid gap-3 rounded-[var(--radius-medium)] border border-[var(--line)] p-4 sm:grid-cols-3">
            <div><dt className="text-xs font-bold text-[var(--muted)]">Código externo</dt><dd className="mt-1 text-sm font-black">{item.externalCode || "Não informado"}</dd></div>
            <div><dt className="text-xs font-bold text-[var(--muted)]">Sistema de classificação</dt><dd className="mt-1 text-sm font-black">{item.classificationSystem || "Não informado"}</dd></div>
            <div><dt className="text-xs font-bold text-[var(--muted)]">Versão da fonte</dt><dd className="mt-1 text-sm font-black">{item.sourceVersion || "Não informado"}</dd></div>
          </dl>
        ) : null}
        {item.professionalNotes ? (
          <div className="rounded-[var(--radius-medium)] border border-[var(--line)] p-4">
            <p className="text-xs font-bold text-[var(--muted)]">Observações profissionais</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-[var(--text-primary)]">{item.professionalNotes}</p>
          </div>
        ) : null}
        <section aria-labelledby="scientific-content-title">
          <h3
            className="text-sm font-black text-[var(--text-primary)]"
            id="scientific-content-title"
          >
            Conteúdo científico e aplicação profissional
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <ScientificTextField
              label="Conteúdo técnico"
              value={item.technicalContent}
            />
            <ScientificTextField
              label="Aplicação profissional"
              value={item.professionalApplication}
            />
            <ScientificTextField
              label="População-alvo"
              value={item.targetPopulation}
            />
            <ScientificTextField label="Indicações" value={item.indications} />
            <ScientificTextField
              label="Contraindicações"
              value={item.contraindications}
            />
            <ScientificTextField label="Precauções" value={item.precautions} />
            <ScientificTextField
              className="sm:col-span-2"
              label="Limitações"
              value={item.limitations}
            />
          </dl>
        </section>
        <section aria-labelledby="scientific-references-title">
          <h3
            className="text-sm font-black text-[var(--text-primary)]"
            id="scientific-references-title"
          >
            Referências bibliográficas
          </h3>
          {item.references?.length ? (
            <ol className="mt-3 grid gap-3">
              {item.references.map((reference, index) => (
                <ScientificReferenceDetails
                  index={index}
                  key={reference.id}
                  reference={reference}
                />
              ))}
            </ol>
          ) : (
            <p className="mt-2 rounded-[var(--radius-medium)] border border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              Nenhuma referência informada.
            </p>
          )}
        </section>
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(item.attributes).map(([label, value]) => (
            <div
              className="rounded-[var(--radius-medium)] border border-[var(--line)] p-3"
              key={label}
            >
              <dt className="text-xs font-bold text-[var(--muted)]">
                {label}
              </dt>
              <dd className="mt-2 text-sm font-bold text-[var(--text-primary)]">
                <StructuredValue value={parseScientificAttributeValue(value)} />
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="text-sm font-black text-[var(--text-primary)]">Tags</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-black text-[var(--text-primary)]">
            Reutilização autorizada futura
          </h3>
          <ul className="mt-2 grid gap-2 text-sm text-[var(--text-secondary)]">
            {item.reusableBy.map((module) => (
              <li
                className="rounded-lg bg-[var(--surface-elevated)] px-3 py-2"
                key={module}
              >
                {module}
              </li>
            ))}
          </ul>
        </div>
        {item.revisions?.length ? (
          <div className="rounded-[var(--radius-medium)] border border-[var(--line)] p-4">
            <h3 className="text-sm font-black text-[var(--text-primary)]">
              Histórico de revisões
            </h3>
            <ol className="mt-3 grid gap-3">
              {item.revisions.map((revision) => {
                const revisionStatus =
                  editorialStatusPresentation[revision.editorialStatus];
                return (
                  <li
                    className="rounded-lg bg-[var(--surface-elevated)] p-3 text-sm text-[var(--text-secondary)]"
                    key={revision.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-[var(--text-primary)]">
                        Versão {revision.version}
                      </span>
                      <Badge tone={revisionStatus.tone}>
                        {revisionStatus.label}
                      </Badge>
                      <span>{formatDate(revision.createdAt)}</span>
                    </div>
                    {revision.changeReason ? (
                      <p className="mt-2">{revision.changeReason}</p>
                    ) : null}
                    {revision.reviewNotes ? (
                      <p className="mt-1">{revision.reviewNotes}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
        <p className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
          {isUnvalidatedContent
            ? `${unvalidatedContentLabel}. `
            : "Registro profissional. "}
          Sem cálculo, prescrição ou interpretação automática.
        </p>
      </div>
    </Card>
  );
}
