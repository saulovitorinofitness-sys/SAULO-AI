import { PageState } from "@/components/ui/page-state";

export function EmptyState() {
  return <PageState description="Nenhuma coleta foi disponibilizada para este atendimento." title="Coleta indisponível" />;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <PageState action={onRetry ? <button className="min-h-11 rounded-xl bg-[#12664f] px-5 text-sm font-black text-white" onClick={onRetry} type="button">Tentar novamente</button> : undefined} description="Não foi possível carregar ou salvar a coleta. Nenhum dado existente foi removido." title="Erro na coleta" tone="danger" />;
}

export function PermissionDeniedState() {
  return <PageState description="O perfil conectado não pode acessar esta coleta. A autorização do back-end continuará obrigatória quando os endpoints existirem." title="Acesso não permitido" tone="blocked" />;
}
