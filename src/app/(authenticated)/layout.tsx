import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/auth/authenticated-shell";
import { MockNotice } from "@/components/ui/mock-notice";
import { DevelopmentSessionProvider } from "@/features/development-session";
import { mvpService } from "@/features/mvp";

type LayoutProps = {
  children: ReactNode;
};

export default async function AuthenticatedLayout({
  children,
}: LayoutProps) {
  const access = await mvpService.getSession();

  return (
    <>
      <MockNotice />
      <DevelopmentSessionProvider initialUser={access.user}>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </DevelopmentSessionProvider>
    </>
  );
}
