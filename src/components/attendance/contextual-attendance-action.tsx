import Link from "next/link";

import { ArrowIcon } from "@/components/ui/icons";
import type { CurrentAttendanceAction } from "@/features/clinical-collection";

export function ContextualAttendanceAction({ action }: { action: CurrentAttendanceAction }) {
  return <Link className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${action.primary ? "bg-[#12664f] text-white hover:bg-[#0a4938]" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} href={action.href}>{action.label}{action.primary ? <ArrowIcon className="size-4" /> : null}</Link>;
}
