"use client";

import { useState } from "react";
import { Card, Checkbox, SectionHeader } from "@/components/ui";
import type { ExecutiveTask } from "@/features/executive-dashboard";

export function TaskPanel({ initialTasks }: { initialTasks: readonly ExecutiveTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  return <Card className="p-5 md:p-6"><SectionHeader description="Checklist local; alterações não são persistidas." title="Próximas tarefas" /><ul className="mt-5 divide-y divide-[var(--line)]" role="list">{tasks.map((task) => <li className="flex items-start gap-3 py-3" key={task.id}><Checkbox aria-describedby={`${task.id}-area`} checked={task.completed} id={task.id} onChange={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} /><div><label className={`cursor-pointer text-sm font-bold ${task.completed ? "text-[var(--muted)] line-through" : "text-[var(--text-primary)]"}`} htmlFor={task.id}>{task.label}</label><p className="mt-0.5 text-xs text-[var(--muted)]" id={`${task.id}-area`}>{task.area}</p></div></li>)}</ul></Card>;
}
