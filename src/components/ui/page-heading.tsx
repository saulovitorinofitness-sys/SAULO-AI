import type { ReactNode } from "react";

import { ChevronLeftIcon } from "./icons";
import { ButtonLink } from "./button";

export function PageHeading({ eyebrow, title, description, action, backHref }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; backHref?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref ? <ButtonLink className="mb-4" href={backHref} size="small" variant="link"><ChevronLeftIcon className="size-4" />Voltar</ButtonLink> : null}
        {eyebrow ? <p className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">{eyebrow}</p> : null}
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-[length:var(--font-page-title)]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[length:var(--font-page-subtitle)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
