"use client";

import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  NextFitReceiptMethod,
  NextFitReceiptPreview,
} from "@/features/financial/nextfit-receipts";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const destinationLabels: Record<string, string> = {
  NUBANK: "Nubank",
  SUMUP: "SumUp",
  CAIXA_FISICO: "Caixa físico",
};

const methodLabels: Record<NextFitReceiptMethod, string> = {
  PIX_DEPOSIT: "PIX/Depósito",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  CASH: "Dinheiro",
};

export function buildNextFitReceiptDestinationSummary(preview: NextFitReceiptPreview) {
  const destinations = new Map<string, {
    account: string;
    method: string;
    amount: number;
    count: number;
  }>();
  for (const row of preview.rows) {
    if (
      row.status !== "VALID" ||
      !row.method ||
      !row.destinationAccountCode ||
      !row.amount
    ) continue;
    const key = `${row.destinationAccountCode}:${row.method}`;
    const current = destinations.get(key);
    destinations.set(key, {
      account: destinationLabels[row.destinationAccountCode] ?? row.destinationAccountCode,
      method: methodLabels[row.method],
      amount: (current?.amount ?? 0) + Number(row.amount),
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...destinations.values()];
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
  if (payload?.code === "DUPLICATE_FILE") return "Este arquivo já foi importado anteriormente.";
  return payload?.message ?? "Não foi possível processar os recebimentos NextFit.";
}

export function NextFitReceiptsImportDialog({
  open,
  onClose,
  onConfirmed,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirmed: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<NextFitReceiptPreview>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setFile(undefined);
        setPreview(undefined);
        setError(undefined);
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;

  function resetPreview() {
    setFile(undefined);
    setPreview(undefined);
    setError(undefined);
  }

  function closeDialog() {
    if (busy) return;
    resetPreview();
    onClose();
  }

  async function generatePreview(selectedFile: File) {
    setBusy(true);
    setError(undefined);
    try {
      const data = new FormData();
      data.set("file", selectedFile);
      const response = await fetch("/api/financial/imports/nextfit-receipts/preview", {
        method: "POST",
        headers: developmentUserRequestHeaders(),
        body: data,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as { preview: NextFitReceiptPreview };
      setPreview(payload.preview);
    } catch (cause) {
      setPreview(undefined);
      setError(cause instanceof Error ? cause.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!file || !preview?.canConfirm) return;
    setBusy(true);
    setError(undefined);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("expectedHash", preview.fileHash);
      const response = await fetch("/api/financial/imports/nextfit-receipts/confirm", {
        method: "POST",
        headers: developmentUserRequestHeaders(),
        body: data,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await response.json();
      resetPreview();
      onConfirmed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar a importação.");
    } finally {
      setBusy(false);
    }
  }

  const destinationSummary = preview
    ? buildNextFitReceiptDestinationSummary(preview)
    : [];
  const skippedRows = preview?.rows.filter((row) => row.status !== "VALID") ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5"
      onMouseDown={(event) => event.currentTarget === event.target && closeDialog()}
    >
      <section
        aria-labelledby="nextfit-receipts-title"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Academia · NextFit</p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="nextfit-receipts-title">Importar recebimentos NextFit</h2>
            <p className="mt-1 text-sm text-slate-500">Importe os recebimentos realizados da Academia para atualizar o Fluxo de Caixa.</p>
          </div>
          <button aria-label="Fechar" className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" disabled={busy} onClick={closeDialog} type="button"><X aria-hidden="true" className="size-5" /></button>
        </header>

        <div className="space-y-4 p-5 sm:p-6">
          {!preview ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <FileSpreadsheet aria-hidden="true" className="mt-0.5 size-5 text-emerald-700" />
                <div><label className="block text-sm font-black text-slate-900" htmlFor="nextfit-receipts-file">Selecionar relatório</label><p className="mt-1 text-xs text-slate-500">XLS ou XLSX, até 10 MB. Conta e forma são definidas automaticamente.</p></div>
              </div>
              <input
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="mt-4 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-bold file:text-emerald-800"
                disabled={busy}
                id="nextfit-receipts-file"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  if (!selectedFile) return;
                  setFile(selectedFile);
                  setPreview(undefined);
                  void generatePreview(selectedFile);
                }}
                type="file"
              />
              {busy ? <p aria-live="polite" className="mt-3 text-sm font-semibold text-emerald-800" role="status">Analisando arquivo…</p> : null}
            </div>
          ) : null}

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}

          {preview ? (
            <div className="space-y-4">
              {preview.duplicateBatch ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" role="status">Este arquivo já foi importado anteriormente.</p> : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Período identificado", preview.periodStart && preview.periodEnd ? `${preview.periodStart} → ${preview.periodEnd}` : "—"],
                  ["Total de registros", String(preview.rowCount)],
                  ["Recebimentos válidos", String(preview.validCount)],
                  ["Duplicados", String(preview.duplicateCount)],
                  ["Inválidos", String(preview.invalidCount)],
                  ["Valor total válido", money.format(Number(preview.validAmount))],
                ].map(([label, value]) => <div className="rounded-xl border border-slate-200 p-3" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p></div>)}
              </div>

              {destinationSummary.length ? (
                <section aria-labelledby="nextfit-destinations-title">
                  <h3 className="text-sm font-black text-slate-950" id="nextfit-destinations-title">Destino financeiro</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {destinationSummary.map((destination) => (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3" key={`${destination.account}-${destination.method}`}>
                        <div><p className="text-sm font-black text-emerald-950">{destination.account}</p><p className="text-xs text-emerald-800">{destination.method} · {destination.count} registro(s)</p></div>
                        <p className="whitespace-nowrap text-sm font-black tabular-nums text-emerald-950">{money.format(destination.amount)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {skippedRows.length ? (
                <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-black text-amber-950">{skippedRows.length} registro(s) não serão importados</summary>
                  <ul className="mt-3 max-h-36 space-y-2 overflow-y-auto text-xs text-amber-900">
                    {skippedRows.map((row) => <li key={`${row.sheetName}-${row.rowNumber}`}><strong>Linha {row.rowNumber}:</strong> {row.issues.map((issue) => issue.message).join(" ") || (row.status === "DUPLICATE" ? "Registro duplicado." : "Registro inválido.")}</li>)}
                  </ul>
                </details>
              ) : null}

              {preview.issues.some((issue) => issue.code === "MISSING_REFERENCE") ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{preview.issues.filter((issue) => issue.code === "MISSING_REFERENCE").map((issue) => issue.message).join(" ")}</p> : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <Button disabled={busy} onClick={resetPreview} type="button" variant="ghost">Voltar</Button>
                <Button disabled={!file || !preview.canConfirm} loading={busy} onClick={confirmImport} type="button"><Upload aria-hidden="true" className="size-4" />Confirmar importação</Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
