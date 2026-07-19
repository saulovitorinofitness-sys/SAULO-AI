"use client";

import { useEffect, useRef, useState } from "react";
import { Button, FormField, Textarea } from "@/components/ui";

const fields = [
  { id: "meeting-results", label: "Resultados da semana" },
  { id: "meeting-problems", label: "Problemas" },
  { id: "meeting-solutions", label: "Soluções" },
  { id: "meeting-goals", label: "Metas" },
  { id: "meeting-actions", label: "Próximas ações" },
] as const;

export function MeetingDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onMouseDown={onClose}><section aria-labelledby="meeting-title" aria-modal="true" className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[var(--surface)] shadow-[var(--shadow-elevated)]" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-white p-5 md:p-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Registro demonstrativo</p><h2 className="mt-1 text-xl font-black text-[var(--text-primary)] outline-none" id="meeting-title" ref={headingRef} tabIndex={-1}>Reunião Semanal</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Organize a pauta executiva sem persistência real.</p></div><Button aria-label="Fechar reunião semanal" onClick={onClose} size="small" variant="ghost">Fechar</Button></header><form className="flex flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}><div className="grid gap-5 p-5 md:p-6">{fields.map((field) => <FormField id={field.id} key={field.id} label={field.label}><Textarea aria-describedby={`${field.id}-help`} className="mt-2" id={field.id} onChange={() => setSaved(false)} placeholder="Registrar informação demonstrativa..." /><span className="sr-only" id={`${field.id}-help`}>Campo demonstrativo sem persistência.</span></FormField>)}{saved ? <p aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Reunião salva apenas nesta sessão visual.</p> : null}</div><footer className="sticky bottom-0 mt-auto flex flex-col-reverse gap-2 border-t border-[var(--line)] bg-white p-5 sm:flex-row sm:justify-end"><Button onClick={onClose} type="button" variant="outline">Cancelar</Button><Button type="submit">Salvar registro mockado</Button></footer></form></section></div>;
}
