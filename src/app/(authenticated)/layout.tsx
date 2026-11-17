import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthenticatedShell } from "@/components/auth/authenticated-shell";
import { mvpService } from "@/features/mvp";
import { loginPathFor } from "@/features/mvp/authentication-navigation";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";

type LayoutProps = {
  children: ReactNode;
};

export default async function AuthenticatedLayout({
  children,
}: LayoutProps) {
  try {
    const session = await mvpService.getSession();
    if (session.user.profileType === "STUDENT") redirect("/portal");
  } catch (error) {
    if (!isSessionAuthenticationError(error)) throw error;
    const requestHeaders = await headers();
    redirect(loginPathFor(requestHeaders.get("x-saulo-ai-return-to")));
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
