"use client";

import { useState } from "react";
import { Card, Input, SectionHeader, StatusBadge } from "@/components/ui";
import type { WeeklyGoal } from "@/features/executive-intelligence";

export function WeeklyGoals({ initialGoals }: { initialGoals: readonly WeeklyGoal[] }) {
  const [goals, setGoals] = useState(() => [...initialGoals]);
  return <Card className="p-5 md:p-6"><SectionHeader description="Metas editáveis para organização da próxima semana." title="Metas da próxima semana" /><div className="mt-5 grid gap-3">{goals.map((goal) => <div className="rounded-[var(--radius-medium)] border border-[var(--line)] p-4" key={goal.id}><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">{goal.area}</p><StatusBadge status={goal.status === "completed" ? "completed" : goal.status === "in_progress" ? "in_progress" : "pending"} /></div><label className="sr-only" htmlFor={`goal-${goal.id}`}>Descrição da meta de {goal.area}</label><Input className="mt-3" id={`goal-${goal.id}`} onChange={(event) => setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, description: event.target.value } : item))} value={goal.description} /><p className="mt-2 text-xs text-[var(--text-secondary)]">Alvo mockado: <strong>{goal.target}</strong></p></div>)}</div></Card>;
}

