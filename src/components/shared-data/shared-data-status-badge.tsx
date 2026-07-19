import { StatusBadge } from "@/components/ui";
import type { SharedDataStatus } from "@/features/shared-data";
const statusMap = { DRAFT: "in_progress", ACTIVE: "active", INACTIVE: "inactive", REVIEWED: "reviewed", ARCHIVED: "unavailable" } as const;
export function SharedDataStatusBadge({ status }: { status: SharedDataStatus }) { return <StatusBadge status={statusMap[status]} />; }
