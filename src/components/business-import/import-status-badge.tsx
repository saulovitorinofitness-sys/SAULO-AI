import { StatusBadge } from "@/components/ui";
import type { ImportStatus, ImportValidation } from "@/features/business-import";

export function ImportStatusBadge({ status }: { status: ImportStatus | ImportValidation["status"] }) {
  const config = { idle: ["pending", "Aguardando"], validating: ["in_progress", "Validando"], mapping: ["in_progress", "Mapeando"], review: ["attention", "Em revisão"], completed: ["completed", "Concluída"], completed_with_warnings: ["attention", "Concluída com alertas"], failed: ["error", "Falhou"], cancelled: ["blocked", "Cancelada"], valid: ["success", "Válido"], valid_with_warnings: ["attention", "Válido com alertas"], invalid: ["error", "Inválido"], awaiting_review: ["pending", "Aguardando revisão"] } as const;
  const [badge, label] = config[status]; return <StatusBadge label={label} status={badge} />;
}

