import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Sair" };

export default function LogoutPage() {
  return (
    <>
      <PageHeading description="A autenticação do navegador ainda não possui endpoint nesta etapa do projeto." eyebrow="Sessão" title="Sair do SAULO AI" />
      <section className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black text-amber-950">Logout aguardando integração</h2><p className="mt-2 text-sm leading-6 text-amber-900">Nenhuma sessão real será encerrada no ambiente demonstrativo. O item foi mantido na navegação para validar o fluxo e a acessibilidade do layout autenticado.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white" href="/pacientes">Voltar para pacientes</Link></section>
    </>
  );
}
