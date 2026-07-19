import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const fieldControlStyles = "min-h-11 w-full rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text-primary)] outline-none transition duration-[var(--transition-fast)] placeholder:text-slate-400 focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 read-only:bg-slate-50";

export function FormField({ id, label, required, help, error, children, className = "" }: { id: string; label: string; required?: boolean; help?: string; error?: string; children: ReactNode; className?: string }) {
  const descriptionId = help || error ? `${id}-description` : undefined;
  return <div className={className}><label className="block text-sm font-bold text-[var(--text-secondary)]" htmlFor={id}>{label}{required ? <><span aria-hidden="true" className="ml-1 text-[var(--danger)]">*</span><span className="sr-only"> (obrigatório)</span></> : null}</label>{children}{descriptionId ? <p className={`mt-1.5 text-xs leading-5 ${error ? "text-[var(--danger)]" : "text-[var(--muted)]"}`} id={descriptionId} role={error ? "alert" : undefined}>{error ?? help}</p> : null}</div>;
}
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`${fieldControlStyles} ${className}`} {...props} />; }
export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) { return <Input inputMode="decimal" step="any" type="number" {...props} />; }
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`${fieldControlStyles} ${className}`} {...props} />; }
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={`${fieldControlStyles} min-h-28 py-3 ${className}`} {...props} />; }
export function Checkbox({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`size-4 rounded border-[var(--line-strong)] text-[var(--primary)] accent-[var(--primary)] ${className}`} type="checkbox" {...props} />; }
