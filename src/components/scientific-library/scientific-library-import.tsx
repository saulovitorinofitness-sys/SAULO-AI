"use client";

import { useRef, useState } from "react";

import {
  Badge,
  Button,
  Card,
  FormField,
  Select,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  ScientificLibraryDomain,
  ScientificLibraryItem,
} from "@/features/scientific-library/contracts";
import {
  analyzeScientificLibraryFile,
  buildScientificLibraryImportPreview,
  suggestScientificLibraryMapping,
} from "@/features/scientific-library/import";
import {
  SCIENTIFIC_LIBRARY_STATUSES,
  scientificLibraryStatusLabels,
  type ScientificLibraryColumnMapping,
  type ScientificLibraryImportAnalysis,
  type ScientificLibraryImportPreview,
  type ScientificLibraryStatus,
} from "@/features/scientific-library/management-contracts";
import {
  SCIENTIFIC_LIBRARY_AREAS,
  scientificLibraryAreaDomains,
  scientificLibraryAreaLabels,
  type ScientificLibraryArea,
} from "@/features/scientific-library/organization";
import { scientificLibraryDomainLabels } from "@/features/scientific-library/labels";

const mappingLabels: Readonly<Record<keyof ScientificLibraryColumnMapping, string>> = {
  name: "Nome ou título",
  description: "Descrição",
  tags: "Tags",
  source: "Fonte ou origem",
  professionalNotes: "Observações profissionais",
  externalCode: "Código externo",
  classificationSystem: "Sistema de classificação",
  sourceVersion: "Versão da fonte",
  modality: "Modalidade",
  movementPattern: "Padrão de movimento",
  classifications: "Classificações",
  difficulty: "Nível de dificuldade",
  bodyRegion: "Grupos musculares / regiões",
  primaryMuscles: "Músculos primários",
  secondaryMuscles: "Músculos secundários / sinergistas",
  objectives: "Objetivos / aplicações",
  equipment: "Equipamentos",
  complementaryEquipment: "Equipamento complementar",
  startPosition: "Posição inicial",
  execution: "Execução técnica",
  commonErrors: "Erros comuns",
  cautions: "Cuidados / restrições profissionais",
  regressions: "Regressões",
  progressions: "Progressões",
  alternatives: "Alternativas / substituições",
  videoUrl: "URL de vídeo demonstrativo",
  imageUrl: "URL de imagem",
  applicableView: "Plano ou vista aplicável",
  relevance: "Relevância",
};

const commonMappingFields: readonly (keyof ScientificLibraryColumnMapping)[] = [
  "name",
  "description",
  "tags",
  "source",
  "professionalNotes",
  "externalCode",
  "classificationSystem",
  "sourceVersion",
];

function mappingFields(domain: ScientificLibraryDomain) {
  if (domain === "EXERCISE") {
    return [
      ...commonMappingFields,
      "modality",
      "movementPattern",
      "classifications",
      "difficulty",
      "bodyRegion",
      "primaryMuscles",
      "secondaryMuscles",
      "objectives",
      "equipment",
      "complementaryEquipment",
      "startPosition",
      "execution",
      "commonErrors",
      "cautions",
      "regressions",
      "progressions",
      "alternatives",
      "videoUrl",
      "imageUrl",
    ] as const;
  }
  if (domain === "POSTURAL_CHANGE") {
    return [...commonMappingFields, "bodyRegion", "applicableView", "relevance"] as const;
  }
  return commonMappingFields;
}

export function ScientificLibraryImport({
  currentItems,
  initialArea,
  initialDomain,
  onCancel,
  onImported,
}: {
  currentItems: readonly ScientificLibraryItem[];
  initialArea: ScientificLibraryArea;
  initialDomain?: ScientificLibraryDomain;
  onCancel: () => void;
  onImported: (items: readonly ScientificLibraryItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<ScientificLibraryImportAnalysis>();
  const [mapping, setMapping] = useState<ScientificLibraryColumnMapping>({});
  const [preview, setPreview] = useState<ScientificLibraryImportPreview>();
  const [area, setArea] = useState<ScientificLibraryArea>(initialArea);
  const [domain, setDomain] = useState<ScientificLibraryDomain>(() =>
    initialDomain && scientificLibraryAreaDomains[initialArea].includes(initialDomain)
      ? initialDomain
      : scientificLibraryAreaDomains[initialArea][0],
  );
  const [status, setStatus] = useState<ScientificLibraryStatus>("DRAFT");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function selectFile(file: File) {
    setBusy(true);
    setMessage("");
    setPreview(undefined);
    try {
      const nextAnalysis = await analyzeScientificLibraryFile(file);
      setAnalysis(nextAnalysis);
      setMapping(suggestScientificLibraryMapping(nextAnalysis.headers));
      setMessage("Arquivo analisado localmente. Revise o mapeamento antes do preview.");
    } catch (error) {
      setAnalysis(undefined);
      setMapping({});
      setMessage(error instanceof Error ? error.message : "Não foi possível analisar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  function buildPreview() {
    if (!analysis) return;
    const next = buildScientificLibraryImportPreview({
      analysis,
      mapping,
      area,
      domain,
      status,
      currentItems,
    });
    setPreview(next);
    setMessage("Preview concluído. Nenhum registro foi persistido.");
  }

  async function confirmImport() {
    if (!analysis || !preview?.valid) return;
    const drafts = preview.rows.flatMap((row) =>
      row.status === "VALID" && row.draft ? [row.draft] : [],
    );
    setBusy(true);
    setMessage("Confirmando importação...");
    const response = await fetch("/api/scientific-library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
      },
      body: JSON.stringify({
        mode: "IMPORT",
        confirm: true,
        fileName: analysis.fileName,
        drafts,
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | {
          items?: readonly ScientificLibraryItem[];
          created?: number;
          duplicates?: number;
          message?: string;
        }
      | null;
    if (!response.ok || !result?.items) {
      setMessage(result?.message ?? "Não foi possível confirmar a importação.");
      setBusy(false);
      return;
    }
    setMessage(
      `${result.created ?? result.items.length} item(ns) importado(s); ${result.duplicates ?? 0} duplicado(s) ignorado(s).`,
    );
    setBusy(false);
    onImported(result.items);
  }

  function selectArea(nextArea: ScientificLibraryArea) {
    setArea(nextArea);
    setDomain(scientificLibraryAreaDomains[nextArea][0]);
    setPreview(undefined);
  }

  return (
    <Card className="mb-4 p-5 md:p-6" variant="elevated">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Gestão do conhecimento</p>
          <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Importar arquivo</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">CSV, XLSX ou JSON estruturado · máximo 10 MB</p>
        </div>
        <Button onClick={onCancel} size="small" type="button" variant="ghost">Fechar</Button>
      </div>

      <div className="mt-5 rounded-xl border-2 border-dashed border-[var(--line-strong)] bg-[var(--surface-elevated)] p-5 text-center">
        <input
          accept=".csv,.xlsx,.json"
          className="sr-only"
          id="scientific-import-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void selectFile(file);
          }}
          ref={inputRef}
          type="file"
        />
        <p className="font-black text-[var(--text-primary)]">Selecione o arquivo para análise local</p>
        <p className="mt-1 text-xs text-[var(--muted)]">A análise e o preview não persistem registros.</p>
        <Button className="mt-4" loading={busy && !analysis} onClick={() => inputRef.current?.click()} type="button">Selecionar arquivo</Button>
      </div>

      {analysis ? (
        <div className="mt-5 grid gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{analysis.format}</Badge>
            <Badge>{analysis.fileName}</Badge>
            <Badge>{analysis.rows.length} linha(s)</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField id="import-area" label="Área profissional">
              <Select id="import-area" onChange={(event) => selectArea(event.target.value as ScientificLibraryArea)} value={area}>
                {SCIENTIFIC_LIBRARY_AREAS.map((option) => <option key={option} value={option}>{scientificLibraryAreaLabels[option]}</option>)}
              </Select>
            </FormField>
            <FormField id="import-domain" label="Domínio">
              <Select id="import-domain" onChange={(event) => { setDomain(event.target.value as ScientificLibraryDomain); setPreview(undefined); }} value={domain}>
                {scientificLibraryAreaDomains[area].map((option) => <option key={option} value={option}>{scientificLibraryDomainLabels[option]}</option>)}
              </Select>
            </FormField>
            <FormField id="import-status" label="Status inicial">
              <Select id="import-status" onChange={(event) => { setStatus(event.target.value as ScientificLibraryStatus); setPreview(undefined); }} value={status}>
                {SCIENTIFIC_LIBRARY_STATUSES.map((option) => <option key={option} value={option}>{scientificLibraryStatusLabels[option]}</option>)}
              </Select>
            </FormField>
          </div>

          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)]">Mapear colunas</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {mappingFields(domain).map((field) => (
                <FormField id={`mapping-${field}`} key={field} label={mappingLabels[field]} required={field === "name"}>
                  <Select
                    id={`mapping-${field}`}
                    onChange={(event) => {
                      setMapping({ ...mapping, [field]: event.target.value || undefined });
                      setPreview(undefined);
                    }}
                    value={mapping[field] ?? ""}
                  >
                    <option value="">Não mapear</option>
                    {analysis.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </Select>
                </FormField>
              ))}
            </div>
          </div>
          <Button onClick={buildPreview} type="button" variant="secondary">Gerar preview e validar</Button>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Total", preview.total],
              ["Válidos", preview.valid],
              ["Inválidos", preview.invalid],
              ["Duplicados", preview.duplicates],
              ["Campos não reconhecidos", preview.unrecognizedFields.length],
            ].map(([label, value]) => (
              <div className="rounded-xl border border-[var(--line)] p-3" key={label}>
                <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-xl font-black text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>
          {preview.unrecognizedFields.length ? (
            <p className="text-xs text-[var(--muted)]">Não reconhecidos: {preview.unrecognizedFields.join(" · ")}</p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--muted)]">
                <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Observações</th></tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row) => (
                  <tr className="border-t border-[var(--line)]" key={row.rowNumber}>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-bold">{row.draft?.name || "Não informado"}</td>
                    <td className="px-3 py-2">{row.status === "VALID" ? "Válido" : row.status === "DUPLICATE" ? "Duplicado" : "Inválido"}</td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">{row.issues.join(" · ") || "Pronto para importar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs font-bold text-[var(--muted)]">A confirmação importa somente registros válidos. Duplicados e inválidos não são criados.</p>
          <Button disabled={!preview.valid} loading={busy} onClick={() => void confirmImport()} type="button">Confirmar importação de {preview.valid} item(ns)</Button>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-4 min-h-5 text-sm font-bold text-[var(--text-secondary)]" role="status">{message}</p>
    </Card>
  );
}
