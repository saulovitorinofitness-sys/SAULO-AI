import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/auth/authenticated-shell";
import { MockNotice } from "@/components/ui/mock-notice";
import { mvpService } from "@/features/mvp";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const access = await mvpService.getSession();
  return (
    <>
      <MockNotice />
      <AuthenticatedShell user={access.user}>{children}</AuthenticatedShell>
    </>
  );
}
