import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
export function TableRegion({ label, children, className = "" }: HTMLAttributes<HTMLDivElement> & { label: string }) { return <div aria-label={label} className={`overflow-x-auto rounded-[var(--radius-large)] border border-[var(--line)] bg-[var(--surface)] ${className}`} role="region">{children}</div>; }
export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) { return <table className={`w-full border-collapse text-left text-sm ${className}`} {...props} />; }
export function TableHead({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead className={`bg-[var(--surface-elevated)] text-xs uppercase tracking-wide text-[var(--muted)] ${className}`} {...props} />; }
export function TableBody({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={`divide-y divide-[var(--line)] ${className}`} {...props} />; }
export function TableHeaderCell({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th className={`px-4 py-3 font-black ${className}`} scope="col" {...props} />; }
export function TableCell({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td className={`px-4 py-3 align-top ${className}`} {...props} />; }
