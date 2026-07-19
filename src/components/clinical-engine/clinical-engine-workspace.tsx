import { Badge, Card, CardDescription, CardTitle, StatusBadge } from "@/components/ui";
import type { ClinicalEngineSection, ClinicalEngineView } from "@/features/clinical-engine";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

const status = {
  COMPLETE: { label: "Dados disponíveis", badge: "completed" as const },
  PENDING: { label: "Dados pendentes", badge: "pending" as const },
  RESTRICTED: { label: "Acesso restrito", badge: "unavailable" as const },
};

const circumferenceLabels: Readonly<Record<string, string>> = {
  neckCm: "Pescoço",
  shouldersCm: "Ombros",
  chestCm: "Tórax",
  waistCm: "Cintura",
  abdomenCm: "Abdômen",
  hipCm: "Quadril",
  rightArmCm: "Braço direito",
  leftArmCm: "Braço esquerdo",
  rightForearmCm: "Antebraço direito",
  leftForearmCm: "Antebraço esquerdo",
  rightThighCm: "Coxa direita",
  leftThighCm: "Coxa esquerda",
  rightCalfCm: "Panturrilha direita",
  leftCalfCm: "Panturrilha esquerda",
};

function formatItem(item: string): string {
  const separator = item.indexOf(":");
  if (separator < 0) return item;
  const key = item.slice(0, separator);
  return `${circumferenceLabels[key] ?? key.replaceAll("_", " ")}${item.slice(separator)}`;
}

function InformationCard({ item, index }: { item: ClinicalEngineSection; index: number }) {
  const currentStatus = status[item.status];
  return (
    <Card aria-labelledby={`clinical-engine-${item.id}`} className="scroll-mt-24 p-4 sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</p>
          <CardTitle className="mt-1" id={`clinical-engine-${item.id}`}>{item.title}</CardTitle>
          <CardDescription>{item.description}</CardDescription>
        </div>
        <StatusBadge label={currentStatus.label} status={currentStatus.badge} />
      </header>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {item.metrics.map((entry) => (
          <div className={`rounded-[var(--radius-medium)] border p-3 ${entry.pending ? "border-amber-200 bg-amber-50" : "border-[var(--line)] bg-[var(--surface-elevated)]"}`} key={entry.label}>
            <dt className="text-xs font-bold text-[var(--muted)]">{entry.label}</dt>
            <dd className="mt-1 break-words text-sm font-black text-[var(--text-primary)]">{entry.value}</dd>
          </div>
        ))}
      </dl>

      {item.items?.length ? (
        <details className="group mt-4 rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
          <summary className="min-h-7 cursor-pointer text-sm font-black text-[var(--text-secondary)]">Ver registros reunidos <span aria-hidden="true" className="float-right group-open:rotate-180">⌄</span></summary>
          <ul className="mt-3 space-y-2 border-t border-[var(--line)] pt-3 text-sm text-[var(--text-secondary)]">
            {item.items.map((entry, itemIndex) => <li className="break-words" key={`${item.id}-${itemIndex}`}>• {formatItem(entry)}</li>)}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function Timeline({ view }: { view: ClinicalEngineView }) {
  return (
    <Card aria-labelledby="clinical-engine-timeline" className="p-4 sm:p-5">
      <CardTitle id="clinical-engine-timeline">Linha do tempo dos atendimentos</CardTitle>
      <CardDescription>Registros existentes organizados cronologicamente, sem análise clínica.</CardDescription>
      {view.timeline.length ? (
        <ol className="relative mt-5 space-y-4 border-l border-[var(--line-strong)] pl-5">
          {view.timeline.map((event) => (
            <li className="relative" key={event.id}>
              <span aria-hidden="true" className="absolute -left-[1.55rem] top-1 size-3 rounded-full border-2 border-white bg-[var(--primary)] ring-1 ring-[var(--line-strong)]" />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-sm font-black text-[var(--text-primary)]">{event.title}</h3>
                <time className="shrink-0 text-xs font-bold text-[var(--muted)]" dateTime={event.occurredAt}>{dateTime.format(new Date(event.occurredAt))}</time>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{event.description}</p>
              <p className="mt-1 text-xs font-bold text-[var(--muted)]">{event.professionalName} · {event.module}</p>
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-[var(--muted)]">Nenhum evento disponível no mock atual.</p>}
    </Card>
  );
}

function FixedSummary({ view }: { view: ClinicalEngineView }) {
  return (
    <aside aria-label="Resumo de integridade do Motor Clínico" className="self-start xl:sticky xl:top-24">
      <Card className="overflow-hidden" variant="elevated">
        <div className="bg-[var(--primary)] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Consolidação automática</p>
          <h2 className="mt-1 text-lg font-black">Estado dos dados</h2>
          <p className="mt-2 text-xs leading-5 text-emerald-50">Indicadores de preenchimento, sem cálculo de risco ou interpretação.</p>
        </div>
        <dl className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3"><dt className="text-sm font-bold text-[var(--text-secondary)]">Dados completos</dt><dd><Badge tone="success">✓ {view.completeSectionCount}</Badge></dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-sm font-bold text-[var(--text-secondary)]">Dados pendentes</dt><dd><Badge tone="warning">• {view.pendingSectionCount}</Badge></dd></div>
          <div className="border-t border-[var(--line)] pt-4"><dt className="text-xs font-bold text-[var(--muted)]">Última atualização</dt><dd className="mt-1 text-sm font-black text-[var(--text-primary)]">{dateTime.format(new Date(view.lastUpdatedAt))}</dd></div>
          <div><dt className="text-xs font-bold text-[var(--muted)]">Profissional responsável</dt><dd className="mt-1 text-sm font-black text-[var(--text-primary)]">{view.responsibleProfessional}</dd></div>
          <div><dt className="text-xs font-bold text-[var(--muted)]">Versão do prontuário</dt><dd className="mt-1 text-sm font-black text-[var(--text-primary)]">{view.masterRecordVersion}</dd></div>
        </dl>
      </Card>
    </aside>
  );
}

export function ClinicalEngineWorkspace({ view }: { view: ClinicalEngineView }) {
  const history = view.sections.find((item) => item.id === "history");
  const informationSections = view.sections.filter((item) => item.id !== "history");
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        <div className="rounded-[var(--radius-large)] border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950" role="note">
          <strong>Visão exclusivamente organizacional.</strong> Os cartões reúnem dados existentes e não emitem diagnóstico, risco, tratamento ou sugestão clínica.
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {informationSections.map((item, index) => <InformationCard index={index} item={item} key={item.id} />)}
        </div>
        {history ? <Timeline view={view} /> : null}
      </div>
      <FixedSummary view={view} />
    </div>
  );
}

