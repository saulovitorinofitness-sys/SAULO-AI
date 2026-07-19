import Link from "next/link";

import { PageState } from "@/components/ui/page-state";

export default function NotFound() {
  return <PageState action={<Link className="inline-flex min-h-11 items-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white" href="/pacientes">Voltar para pacientes</Link>} description="O paciente, prontuário ou atendimento solicitado não foi disponibilizado pelo serviço." title="Registro não encontrado" />;
}
