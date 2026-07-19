import type { ReactNode } from "react";
import { Card } from "./card";

type PageStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "danger" | "blocked";
};

export function PageState({ title, description, action, tone = "default" }: PageStateProps) {
  const marker = tone === "danger" ? "!" : tone === "blocked" ? "×" : "·";
  return (
    <Card className="border-dashed px-6 py-12 text-center" role={tone === "danger" ? "alert" : "status"} variant={tone === "danger" ? "danger" : tone === "blocked" ? "muted" : "default"}>
      <span className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-slate-100 text-xl font-bold text-slate-600">{marker}</span>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}
