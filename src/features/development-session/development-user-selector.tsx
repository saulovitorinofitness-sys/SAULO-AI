"use client";

import { DEVELOPMENT_PROFESSIONAL_OPTIONS } from "./config";
import { useDevelopmentSession } from "./development-session-provider";

export function DevelopmentUserSelector() {
  const { professional, selectUser } = useDevelopmentSession();

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <label
        className="sr-only"
        htmlFor="development-active-user"
      >
        Usuário ativo para desenvolvimento
      </label>

      <select
        aria-describedby="development-mode-notice"
        className="h-9 max-w-[15rem] rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-bold text-amber-950 outline-none transition focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        id="development-active-user"
        onChange={(event) =>
          selectUser(event.target.value as "saulo" | "maria")
        }
        value={professional.key}
      >
        {DEVELOPMENT_PROFESSIONAL_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.user.fullName}
          </option>
        ))}
      </select>

      <span
        className="text-[10px] font-semibold text-amber-800"
        id="development-mode-notice"
      >
        Modo de desenvolvimento — usuário simulado
      </span>
    </div>
  );
}
