"use client";

import { useState } from "react";
import { Card, SectionHeader, Select, StatusBadge } from "@/components/ui";
import type { WeeklyProblem, WorkStatus } from "@/features/executive-intelligence";

const labels: Record<WorkStatus, string> = { pending: "Pendente", in_progress: "Em andamento", completed: "Concluído" };
export function ProblemBoard({ initialProblems }: { initialProblems: readonly WeeklyProblem[] }) {
  const [problems, setProblems] = useState(() => [...initialProblems]);
  return <Card className="p-5 md:p-6"><SectionHeader description="Atualizações permanecem apenas nesta sessão visual." title="Problemas da semana" /><ul className="mt-5 grid gap-3" role="list">{problems.map((problem) => <li className="rounded-[var(--radius-medium)] border border-[var(--line)] p-4" key={problem.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-[var(--text-primary)]">{problem.title}</h3><p className="mt-1 text-xs font-bold text-[var(--muted)]">{problem.area} · {problem.responsible}</p></div><StatusBadge label={problem.priority === "high" ? "Prioridade alta" : problem.priority === "medium" ? "Prioridade média" : "Prioridade baixa"} status={problem.priority === "high" ? "priority" : problem.priority === "medium" ? "attention" : "informative"} /></div><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{problem.description}</p><label className="mt-3 block text-xs font-bold text-[var(--text-secondary)]" htmlFor={`problem-${problem.id}`}>Status</label><Select className="mt-1" id={`problem-${problem.id}`} onChange={(event) => setProblems((items) => items.map((item) => item.id === problem.id ? { ...item, status: event.target.value as WorkStatus } : item))} value={problem.status}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></li>)}</ul></Card>;
}
