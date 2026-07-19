"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, FormField, Textarea } from "@/components/ui";
import type { ExecutiveIntelligenceView, ExecutiveMeetingStep } from "@/features/executive-intelligence";
import { MeetingMinutes, type MeetingMinutesValue } from "./meeting-minutes";

const steps: readonly { id: ExecutiveMeetingStep; label: string; help: string }[] = [
  { id: "summary", label: "Resumo", help: "Registre a leitura geral da semana." },
  { id: "indicators", label: "Indicadores", help: "Registre pontos que merecem conferência." },
  { id: "problems", label: "Problemas", help: "Consolide os problemas discutidos." },
  { id: "actions", label: "Plano de ação", help: "Organize os encaminhamentos definidos." },
  { id: "goals", label: "Metas", help: "Registre metas acordadas." },
  { id: "next_week", label: "Próxima semana", help: "Organize a pauta da próxima semana." },
  { id: "minutes", label: "Ata", help: "Finalize a ata demonstrativa." },
];

const emptyMinutes: MeetingMinutesValue = { decisions: "", pendingItems: "", responsiblePeople: "", notes: "" };

export function MeetingDrawer({ open, onClose, view }: { open: boolean; onClose: () => void; view: ExecutiveIntelligenceView }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [notes, setNotes] = useState<Partial<Record<ExecutiveMeetingStep, string>>>({});
  const [minutes, setMinutes] = useState(emptyMinutes);
  const [saved, setSaved] = useState(false);
  const step = steps[stepIndex];
  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;

  const finish = () => setSaved(true);
  return <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onMouseDown={onClose}><section aria-describedby="intelligence-meeting-description" aria-labelledby="intelligence-meeting-title" aria-modal="true" className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-[var(--surface)] shadow-[var(--shadow-elevated)]" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="sticky top-0 z-10 border-b border-[var(--line)] bg-white p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">Reunião executiva · {view.summary.week}</p><h2 className="mt-1 text-xl font-black text-[var(--text-primary)] outline-none" id="intelligence-meeting-title" ref={headingRef} tabIndex={-1}>Central de Inteligência</h2><p className="mt-1 text-sm text-[var(--text-secondary)]" id="intelligence-meeting-description">Roteiro demonstrativo em sete etapas. Nenhum dado será persistido.</p></div><Button aria-label="Fechar reunião executiva" onClick={onClose} size="small" variant="ghost">Fechar</Button></div><ol aria-label="Etapas da reunião" className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{steps.map((item, index) => <li key={item.id}><button aria-current={index === stepIndex ? "step" : undefined} className={`min-h-9 whitespace-nowrap rounded-full border px-3 text-xs font-black ${index === stepIndex ? "border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary-hover)]" : "border-[var(--line)] text-[var(--muted)]"}`} onClick={() => setStepIndex(index)} type="button">{index + 1}. {item.label}</button></li>)}</ol></header><div className="flex-1 p-5 md:p-6"><div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-[var(--muted)]">Etapa {stepIndex + 1} de {steps.length}</p><h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">{step.label}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{step.help}</p></div></div>{step.id === "summary" ? <Card className="mb-5 p-4" variant="muted"><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><dt className="text-xs text-[var(--muted)]">Receita</dt><dd className="font-black">{view.summary.revenue}</dd></div><div><dt className="text-xs text-[var(--muted)]">Despesas</dt><dd className="font-black">{view.summary.expenses}</dd></div><div><dt className="text-xs text-[var(--muted)]">Lucro</dt><dd className="font-black">{view.summary.profit}</dd></div><div><dt className="text-xs text-[var(--muted)]">Meta</dt><dd className="font-black">{view.summary.goalPercent}%</dd></div></dl></Card> : null}{step.id === "indicators" ? <Card className="mb-5 p-4" variant="muted"><p className="text-sm font-bold text-[var(--text-primary)]">{view.areas.length} áreas consolidadas · {view.alerts.length} alertas para revisão</p></Card> : null}{step.id === "problems" ? <Card className="mb-5 p-4" variant="muted"><p className="text-sm font-bold text-[var(--text-primary)]">{view.problems.length} problemas registrados no cenário demonstrativo.</p></Card> : null}{step.id === "actions" ? <Card className="mb-5 p-4" variant="muted"><p className="text-sm font-bold text-[var(--text-primary)]">{view.actions.length} ações preparadas para acompanhamento.</p></Card> : null}{step.id === "goals" ? <Card className="mb-5 p-4" variant="muted"><p className="text-sm font-bold text-[var(--text-primary)]">{view.goals.length} metas demonstrativas para revisão.</p></Card> : null}{step.id === "minutes" ? <MeetingMinutes onChange={(value) => { setSaved(false); setMinutes(value); }} value={minutes} /> : <FormField help="Conteúdo local e demonstrativo." id={`meeting-${step.id}`} label={`Registro de ${step.label}`}><Textarea className="mt-2 min-h-52" id={`meeting-${step.id}`} onChange={(event) => { setSaved(false); setNotes((current) => ({ ...current, [step.id]: event.target.value })); }} placeholder="Digite as observações da reunião..." value={notes[step.id] ?? ""} /></FormField>}{saved ? <p aria-live="polite" className="mt-5 rounded-[var(--radius-medium)] border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Ata registrada somente nesta sessão demonstrativa.</p> : null}</div><footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--line)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><Button disabled={stepIndex === 0} onClick={() => setStepIndex((value) => Math.max(0, value - 1))} type="button" variant="outline">Anterior</Button><div className="flex flex-col gap-2 sm:flex-row">{stepIndex < steps.length - 1 ? <Button onClick={() => setStepIndex((value) => Math.min(steps.length - 1, value + 1))} type="button">Próxima etapa</Button> : <Button onClick={finish} type="button">Finalizar ata mockada</Button>}</div></footer></section></div>;
}

