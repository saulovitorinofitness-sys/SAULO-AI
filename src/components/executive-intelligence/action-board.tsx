"use client";

import { useState } from "react";
import { Button, Card, Checkbox, SectionHeader, StatusBadge } from "@/components/ui";
import type { ExecutiveAction } from "@/features/executive-intelligence";

export function ActionBoard({ initialActions }: { initialActions: readonly ExecutiveAction[] }) {
  const [actions, setActions] = useState(() => [...initialActions]);
  const [saved, setSaved] = useState(false);
  return <Card className="p-5 md:p-6"><SectionHeader action={<Button onClick={() => setSaved(true)} size="small" variant="outline">Salvar mock</Button>} description="Responsáveis, prazos e execução da semana." title="Plano de ação" /><ul className="mt-5 grid gap-3" role="list">{actions.map((action) => <li className="flex items-start gap-3 rounded-[var(--radius-medium)] border border-[var(--line)] p-4" key={action.id}><Checkbox aria-label={`Marcar ${action.description} como concluída`} checked={action.status === "completed"} className="mt-1 shrink-0" onChange={(event) => { setSaved(false); setActions((items) => items.map((item) => item.id === action.id ? { ...item, status: event.target.checked ? "completed" : "pending" } : item)); }} /><div className="min-w-0 flex-1"><p className={`font-bold ${action.status === "completed" ? "text-[var(--muted)] line-through" : "text-[var(--text-primary)]"}`}>{action.description}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{action.responsible} · prazo {action.dueDate}</p></div><StatusBadge status={action.status === "completed" ? "completed" : action.status === "in_progress" ? "in_progress" : "pending"} /></li>)}</ul>{saved ? <p aria-live="polite" className="mt-4 text-sm font-bold text-[var(--success)]">Plano salvo apenas no estado demonstrativo.</p> : null}</Card>;
}

