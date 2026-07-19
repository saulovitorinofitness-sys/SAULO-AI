import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BRAND_IDENTITIES } from "@/config/branding";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: BRAND_IDENTITIES.clinic.displayName,
    template: `%s | ${BRAND_IDENTITIES.clinic.displayName}`,
  },
  applicationName: BRAND_IDENTITIES.platform.internalName,
  description: BRAND_IDENTITIES.clinic.description,
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
