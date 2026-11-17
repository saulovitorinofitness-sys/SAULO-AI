"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, Button } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  ConfirmedNextFitDreBatch,
  NextFitDrePreview,
} from "@/features/financial/nextfit-dre";
import {
  lineAmountByMonth,
  NEXTFIT_DRE_MONTHS,
} from "@/features/financial/nextfit-dre";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;
const competence = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function competenceLabel(value: string) {
  return competence.format(new Date(`${value}T00:00:00.000Z`));
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? "Não foi possível processar a DRE NextFit.";
}

export function NextFitDreImportDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<NextFitDrePreview>();
  const [batch, setBatch] = useState<ConfirmedNextFitDreBatch>();
  const [baseYear, setBaseYear] = useState("");
  const [lastClosedMonth, setLastClosedMonth] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;

  async function generatePreview() {
    if (!file) {
      setError("Selecione o arquivo XLS/XLSX da DRE NextFit.");
      return;
    }
    if (!lastClosedMonth) {
      setError("Selecione a última competência apurada.");
      return;
    }
    setBusy(true);
    setError(undefined);
    setBatch(undefined);
    try {
      const data = new FormData();
      data.set("file", file);
      if (baseYear) data.set("baseYear", baseYear);
      data.set("lastClosedMonth", lastClosedMonth);
      const response = await fetch("/api/financial/imports/nextfit-dre/preview", {
        method: "POST",
        headers: developmentUserRequestHeaders(),
        body: data,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as { preview: NextFitDrePreview };
      setPreview(payload.preview);
    } catch (cause) {
      setPreview(undefined);
      setError(cause instanceof Error ? cause.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmBatch() {
    if (!file || !preview?.canConfirm) return;
    setBusy(true);
    setError(undefined);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("expectedHash", preview.fileHash);
      data.set("baseYear", String(preview.year));
      data.set("lastClosedMonth", String(preview.exercise.lastClosedMonth));
      const response = await fetch("/api/financial/imports/nextfit-dre/confirm", {
        method: "POST",
        headers: developmentUserRequestHeaders(),
        body: data,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as { batch: ConfirmedNextFitDreBatch };
      setBatch(payload.batch);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o lote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) onClose();
      }}
    >
      <section
        aria-labelledby="nextfit-dre-title"
        aria-modal="true"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-[96vw] sm:rounded-3xl"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Academia · NextFit</p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="nextfit-dre-title">Importar DRE NextFit</h2>
            <p className="mt-1 text-sm text-slate-500">A confirmação registra o lote e sua fotografia gerencial. Nenhum lançamento financeiro será criado.</p>
          </div>
          <button aria-label="Fechar" className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" disabled={busy} onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {batch ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-emerald-700" />
                <div>
                  <p className="font-black text-emerald-950">Lote validado e registrado</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">{batch.fileName} · última competência apurada {competenceLabel(batch.competence)}. {batch.operation === "SNAPSHOT_ATTACHED" ? "Fotografia anexada ao lote histórico existente." : "Fotografia gerencial preservada no novo lote."}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <label className="block text-sm font-black text-slate-900" htmlFor="nextfit-dre-file">Planilha DRE Gerencial</label>
              <p className="mt-1 text-xs leading-5 text-slate-500">Formatos XLS ou XLSX, até 10 MB.</p>
              <input
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="mt-4 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-bold file:text-emerald-800"
                id="nextfit-dre-file"
                onChange={(event) => {
                  setFile(event.target.files?.[0]);
                  setPreview(undefined);
                  setError(undefined);
                }}
                type="file"
              />
              <label className="mt-4 block text-sm font-black text-slate-900" htmlFor="nextfit-dre-year">
                Ano da DRE
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Informe quando o arquivo não apresentar o ano. O sistema não presume esse dado.
              </p>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm sm:max-w-40"
                id="nextfit-dre-year"
                inputMode="numeric"
                max="2100"
                min="2000"
                onChange={(event) => {
                  setBaseYear(event.target.value.replace(/\D/g, "").slice(0, 4));
                  setPreview(undefined);
                  setError(undefined);
                }}
                placeholder="Ex.: 2026"
                type="number"
                value={baseYear}
              />
              <label className="mt-4 block text-sm font-black text-slate-900" htmlFor="nextfit-dre-last-competence">
                Última competência apurada
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-500">Seleção obrigatória e registrada no lote para auditoria.</p>
              <select
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm sm:max-w-56"
                id="nextfit-dre-last-competence"
                onChange={(event) => {
                  setLastClosedMonth(event.target.value);
                  setPreview(undefined);
                  setError(undefined);
                }}
                value={lastClosedMonth}
              >
                <option value="">Selecione</option>
                {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
              <Button className="mt-4" disabled={!file || !lastClosedMonth} loading={busy} onClick={generatePreview} type="button" variant="outline">
                <FileSpreadsheet aria-hidden="true" className="size-4" />
                Gerar prévia
              </Button>
            </div>
          )}

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}

          {preview ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">Arquivo</p><p className="mt-1 break-all text-sm font-black text-slate-900">{preview.fileName}</p></div>
                <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">Ano</p><p className="mt-1 text-sm font-black text-slate-900">{preview.year}</p><p className="mt-1 text-xs text-slate-500">DRE NextFit reconhecida</p></div>
                <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">Competências existentes na DRE</p><p className="mt-1 text-sm font-black text-slate-900">{preview.competenceCount}</p><p className="mt-1 text-xs text-slate-500">Janeiro a Dezembro</p></div>
                <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">Linhas reconhecidas</p><p className="mt-1 text-sm font-black text-slate-900">{preview.lineCount}</p><p className="mt-1 text-xs text-slate-500">{preview.groups.length} grupos identificados</p></div>
              </div>

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Exercício {preview.year}</p>
                    <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-emerald-950 sm:grid-cols-3">
                      <p><span className="font-bold">Existentes:</span> {preview.competenceCount}</p>
                      <p><span className="font-bold">Apuradas:</span> {preview.exercise.closedCount}</p>
                      <p><span className="font-bold">Pendentes:</span> {preview.exercise.pendingCount}</p>
                    </div>
                    <p className="mt-1 text-sm text-emerald-900">
                      Janeiro → {monthNames[preview.exercise.lastClosedMonth - 1]}: apuradas
                      {preview.exercise.pendingCount ? ` · ${monthNames[preview.exercise.lastClosedMonth]} → Dezembro: pendentes` : " · Exercício completo"}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-emerald-950">{preview.exercise.percentage.toLocaleString("pt-BR")}%</p>
                </div>
                <div aria-label={`${preview.exercise.percentage}% do exercício apurado`} className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={preview.exercise.percentage}>
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${preview.exercise.percentage}%` }} />
                </div>
              </section>

              {preview.groups.length ? <section><h3 className="text-sm font-black text-slate-950">Grupos encontrados</h3><div className="mt-2 flex flex-wrap gap-2">{preview.groups.map((group) => <Badge key={group} tone="neutral">{group}</Badge>)}</div></section> : null}

              <section>
                <h3 className="text-sm font-black text-slate-950">DRE Gerencial</h3>
                <p className="mt-1 text-xs text-slate-500">Fotografia do exercício; meses pendentes permanecem visíveis e não são considerados apurados.</p>
                <div className="mt-2 max-h-[56vh] overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1500px] border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-20 bg-slate-900 text-white">
                      <tr>
                        <th className="sticky left-0 z-30 min-w-72 border-b border-r border-slate-700 bg-slate-900 px-4 py-3 text-left">Descrição</th>
                        {NEXTFIT_DRE_MONTHS.map((month, index) => <th className={`min-w-24 border-b border-slate-700 px-3 py-3 text-right ${index + 1 > preview.exercise.lastClosedMonth ? "text-slate-400" : ""}`} key={month}>{month}</th>)}
                        <th className="sticky right-0 z-30 min-w-28 border-b border-l border-slate-700 bg-slate-900 px-4 py-3 text-right shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.7)]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lines.map((line) => {
                        const result = line.kind === "RESULT";
                        const group = line.kind === "GROUP";
                        const rowClass = result ? "bg-emerald-50 font-black text-emerald-950" : group ? "bg-slate-100 font-black text-slate-950" : "bg-white text-slate-700";
                        return <tr className={rowClass} key={`${line.sheetName}-${line.rowNumber}`}>
                          <th className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-2.5 text-left ${rowClass} ${line.kind === "DETAIL" ? "pl-8 font-medium" : ""}`} scope="row">{line.description}</th>
                          {NEXTFIT_DRE_MONTHS.map((month, index) => {
                            const value = lineAmountByMonth(line, index + 1);
                            return <td className={`border-b border-slate-100 px-3 py-2.5 text-right tabular-nums ${index + 1 > preview.exercise.lastClosedMonth ? "text-slate-400" : ""}`} key={month}>{value ? money.format(Number(value.amount)) : "—"}</td>;
                          })}
                          <td className={`sticky right-0 z-10 border-b border-l border-slate-200 px-4 py-2.5 text-right font-bold tabular-nums shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.35)] ${rowClass}`}>{line.total ? money.format(Number(line.total.amount)) : "—"}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {preview.totalCheckCount ? (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-black text-slate-950">Conferência da coluna Total</h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {preview.totalCheckCount} linhas conferidas: {preview.totalMatchCount} compatíveis e {preview.totalMismatchCount} com divergência.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Total é consolidação anual e não foi tratado como competência.</p>
                </section>
              ) : null}

              {preview.warnings.length ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 font-black text-amber-950"><AlertTriangle aria-hidden="true" className="size-4" />Avisos da validação</div>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">{preview.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>• {warning.message}</li>)}</ul>
                </section>
              ) : null}

              {!batch ? <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><Button onClick={onClose} type="button" variant="ghost">Cancelar</Button><Button disabled={!preview.canConfirm} loading={busy} onClick={confirmBatch} type="button"><Upload aria-hidden="true" className="size-4" />{preview.duplicateBatch && !preview.duplicateBatch.hasSnapshot ? "Completar fotografia do lote" : "Confirmar lote validado"}</Button></div> : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
