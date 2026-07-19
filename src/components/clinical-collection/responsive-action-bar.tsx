import type { ReactNode } from "react";

export function ResponsiveActionBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-16 z-10 -mx-4 mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_28px_rgb(15_23_42/0.08)] backdrop-blur sm:bottom-20 sm:mx-0 sm:flex-row sm:justify-end sm:rounded-2xl sm:border lg:bottom-4">{children}</div>;
}
