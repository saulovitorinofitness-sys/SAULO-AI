"use client";

import { useState } from "react";

export function StudentPortalLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <button
      className="min-h-10 rounded-xl border border-white/30 px-3 text-sm font-black text-white disabled:opacity-60"
      disabled={busy}
      onClick={() => void logout()}
      type="button"
    >
      {busy ? "Saindo…" : "Sair"}
    </button>
  );
}
