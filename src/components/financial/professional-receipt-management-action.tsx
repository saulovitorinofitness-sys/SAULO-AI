"use client";

import { AlertTriangle, Trash2, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";

type ManagementAction = "DELETE_DRAFT" | "CANCEL_PAYMENT" | "CANCEL_RECEIPT";

const API_ROOT = "/api/financial/professional-service-receipts";

const copy = {
  DELETE_DRAFT: {
    label: "Excluir rascunho",
    title: "Excluir este rascunho?",
    impact: "O rascunho não possui pagamento nem recibo. A cobrança e seus itens serão excluídos permanentemente.",
    confirm: "Excluir rascunho",
  },
  CANCEL_PAYMENT: {
    label: "Cancelar recebimento",
    title: "Cancelar este recebimento?",
    impact: "O pagamento deixará de compor os valores recebidos, o lançamento financeiro será cancelado e pagamento, liquidação e alocações serão preservados no histórico.",
    confirm: "Confirmar cancelamento",
  },
  CANCEL_RECEIPT: {
    label: "Cancelar recibo",
    title: "Cancelar este recibo?",
    impact: "O recibo não será excluído. Número, série, snapshot e histórico serão preservados e um evento de cancelamento será registrado.",
    confirm: "Confirmar cancelamento",
  },
} as const;

export function ProfessionalReceiptManagementAction({
  action,
  chargeId,
  receiptId,
  amount,
  onComplete,
}: {
  action: ManagementAction;
  chargeId: string;
  receiptId?: string | null;
  amount: string;
  onComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLFormElement>(null);
  const text = copy[action];
  const needsReason = action !== "DELETE_DRAFT";

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !loading) setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [loading, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(undefined);
    try {
      const target = action === "DELETE_DRAFT"
        ? `${API_ROOT}/charges/${encodeURIComponent(chargeId)}`
        : action === "CANCEL_PAYMENT"
          ? `${API_ROOT}/charges/${encodeURIComponent(chargeId)}/cancel`
          : `${API_ROOT}/receipts/${encodeURIComponent(receiptId ?? "")}/cancel`;
      const body = action === "DELETE_DRAFT"
        ? { confirmation: "EXCLUIR_RASCUNHO" }
        : action === "CANCEL_PAYMENT"
          ? { reason: reason.trim(), idempotencyKey: `ui-cancel-charge-${chargeId}` }
          : { reason: reason.trim() };
      const response = await fetch(target, {
        method: action === "DELETE_DRAFT" ? "DELETE" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...developmentUserRequestHeaders() },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível concluir a operação.");
      setOpen(false); setReason("");
      if (onComplete) onComplete(); else window.location.assign("/gestao/financeiro/recibos-servicos");
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "Não foi possível concluir a operação.");
    } finally { setLoading(false); }
  }

  return <>
    <Button onClick={() => { setError(undefined); setOpen(true); }} size="small" type="button" variant="destructive">
      {action === "DELETE_DRAFT" ? <Trash2 aria-hidden="true" className="size-4" /> : <XCircle aria-hidden="true" className="size-4" />}{text.label}
    </Button>
    {open ? <div aria-labelledby={`management-title-${chargeId}`} aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-5" role="dialog"><form className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl" onSubmit={(event) => void submit(event)} ref={dialogRef}>
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><AlertTriangle aria-hidden="true" className="size-6" /></span><div><h2 className="text-xl font-black text-slate-950" id={`management-title-${chargeId}`}>{text.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{text.impact}</p></div></div>
      <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">Impacto financeiro: {amount}. Esta ação não emite recibo e não altera CPF ou cadastro do cliente.</p>
      {needsReason ? <label className="mt-4 grid gap-1.5 text-sm font-bold text-slate-800">Motivo obrigatório<textarea autoFocus className="min-h-24 rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100" maxLength={500} onChange={(event) => setReason(event.target.value)} required value={reason} /></label> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">{error}</p> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={loading} onClick={() => setOpen(false)} type="button" variant="outline">Voltar sem alterar</Button><Button disabled={needsReason && !reason.trim()} loading={loading} type="submit" variant="destructive">{text.confirm}</Button></div>
    </form></div> : null}
  </>;
}
