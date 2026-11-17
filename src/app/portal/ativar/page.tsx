"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function StudentPortalActivationPage() {
  const token = useSearchParams().get("token") ?? "";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"IDLE" | "SAVING" | "DONE" | "ERROR">("IDLE");
  const [message, setMessage] = useState("");

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || password !== confirmation || state === "SAVING") return;
    setState("SAVING");
    setMessage("");
    try {
      const result = await fetch("/api/student-portal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, login, password }),
      });
      const body = (await result.json().catch(() => null)) as { message?: string } | null;
      if (!result.ok) {
        setState("ERROR");
        setMessage(body?.message ?? "Não foi possível ativar o acesso.");
        return;
      }
      setState("DONE");
      setPassword("");
      setConfirmation("");
      setMessage(body?.message ?? "Acesso criado.");
    } catch {
      setState("ERROR");
      setMessage("Não foi possível ativar o acesso.");
    }
  }

  return (
    <main className="min-h-screen bg-[#edf4f0] px-4 py-8 text-[#183029]">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#12664f]">
          Clínica SV
        </p>
        <h1 className="mt-2 text-2xl font-black">Ativar Portal do Aluno</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Defina seu usuário e uma senha pessoal. O convite funciona uma única vez.
        </p>

        {!token ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Convite ausente ou inválido. Solicite um novo convite à Clínica SV.
          </p>
        ) : state === "DONE" ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
              {message}
            </p>
            <Link className="flex min-h-12 items-center justify-center rounded-xl bg-[#12664f] px-4 font-black text-white" href="/">
              Entrar no Portal
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={activate}>
            <label className="block text-sm font-black">
              Usuário
              <input autoCapitalize="none" autoComplete="username" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base" maxLength={254} onChange={(event) => setLogin(event.target.value)} required value={login} />
            </label>
            <label className="block text-sm font-black">
              Senha
              <input autoComplete="new-password" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            <label className="block text-sm font-black">
              Confirmar senha
              <input autoComplete="new-password" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base" maxLength={128} minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
            </label>
            {confirmation && password !== confirmation ? (
              <p className="text-sm font-bold text-rose-700">As senhas não coincidem.</p>
            ) : null}
            {message ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert">{message}</p>
            ) : null}
            <button className="min-h-12 w-full rounded-xl bg-[#12664f] px-4 font-black text-white disabled:opacity-50" disabled={!login.trim() || !password || password !== confirmation || state === "SAVING"} type="submit">
              {state === "SAVING" ? "Ativando…" : "Criar meu acesso"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
