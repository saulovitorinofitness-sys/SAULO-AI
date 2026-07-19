import Link from "next/link";
import type { PatientHubQuickAction } from "@/features/patient-hub";
export function PatientQuickActions({ actions }: { actions: readonly PatientHubQuickAction[] }) { return <section className="rounded-2xl border border-[#dce5e0] bg-white p-4 sm:p-5"><h2 className="text-lg font-black text-[#103f32]">Ações rápidas</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{actions.map((action, index) => <Link className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-center text-sm font-black ${index === 0 ? "bg-[#12664f] text-white" : "border border-[#b8cec5] bg-[#f4faf7] text-[#0a4938]"}`} href={action.href} key={action.id}>{action.label}</Link>)}</div></section>; }

