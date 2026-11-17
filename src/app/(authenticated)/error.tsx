"use client";

import { useRouter } from "next/navigation";

import { PageState } from "@/components/ui/page-state";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  function retry() {
    reset();
    router.refresh();
  }

  return <PageState action={<button className="min-h-11 rounded-xl bg-[#12664f] px-5 text-sm font-black text-white" onClick={retry} type="button">Tentar novamente</button>} description="O conteúdo não pôde ser carregado. Nenhum dado foi alterado." title="Falha ao carregar" tone="danger" />;
}
