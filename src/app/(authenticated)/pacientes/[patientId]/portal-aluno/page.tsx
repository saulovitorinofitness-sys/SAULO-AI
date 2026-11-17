"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ContentType = "DIET" | "WORKOUT" | "ASSESSMENTS" | "POSTURAL_MEDIA" | "PAYMENTS";
type AccessView = {
  patient: { id: string; name: string };
  linked: boolean;
  latestInvitation?: { expiresAt: string; consumedAt?: string; revokedAt?: string };
  releases: Record<ContentType, boolean>;
};

const areas = [
  ["DIET", "Minha dieta"],
  ["WORKOUT", "Meu treino"],
  ["ASSESSMENTS", "Minhas avaliações"],
  ["POSTURAL_MEDIA", "Avaliação postural e fotos"],
  ["PAYMENTS", "Meus pagamentos"],
] as const;

export default function StudentPortalManagementPage() {
  const patientId = String(useParams<{ patientId: string }>().patientId ?? "");
  const [view, setView] = useState<AccessView>();
  const [invitationPath, setInvitationPath] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const result = await fetch(`/api/patients/${encodeURIComponent(patientId)}/student-portal/releases`, { cache: "no-store" });
    const body = (await result.json().catch(() => null)) as AccessView | { message?: string } | null;
    if (!result.ok || !body || !("patient" in body)) {
      setMessage(body && "message" in body ? body.message ?? "Acesso indisponível." : "Acesso indisponível.");
      return;
    }
    setView(body);
  }

  useEffect(() => {
    let active = true;

    void fetch(
      `/api/patients/${encodeURIComponent(patientId)}/student-portal/releases`,
      { cache: "no-store" },
    )
      .then(async (result) => ({
        body: (await result.json().catch(() => null)) as
          | AccessView
          | { message?: string }
          | null,
        ok: result.ok,
      }))
      .then(({ body, ok }) => {
        if (!active) return;
        if (!ok || !body || !("patient" in body)) {
          setMessage(
            body && "message" in body
              ? body.message ?? "Acesso indisponÃ­vel."
              : "Acesso indisponÃ­vel.",
          );
          return;
        }
        setView(body);
      });

    return () => {
      active = false;
    };
  }, [patientId]);

  async function invite() {
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch(`/api/patients/${encodeURIComponent(patientId)}/student-portal/invitations`, { method: "POST" });
      const body = (await result.json().catch(() => null)) as { activationPath?: string; message?: string } | null;
      if (!result.ok || !body?.activationPath) {
        setMessage(body?.message ?? "Não foi possível gerar o convite.");
        return;
      }
      setInvitationPath(body.activationPath);
      setMessage("Convite criado. Copie o endereço e entregue diretamente ao aluno.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(contentType: ContentType, released: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch(`/api/patients/${encodeURIComponent(patientId)}/student-portal/releases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, released }),
      });
      const body = (await result.json().catch(() => null)) as AccessView | { message?: string } | null;
      if (!result.ok || !body || !("patient" in body)) {
        setMessage(body && "message" in body ? body.message ?? "Não foi possível atualizar." : "Não foi possível atualizar.");
        return;
      }
      setView(body);
      setMessage(released ? "Conteúdo liberado para o aluno." : "Conteúdo removido do Portal do Aluno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#12664f]">Clínica SV</p>
          <h1 className="mt-1 text-2xl font-black">Portal do Aluno</h1>
          <p className="mt-1 text-sm text-slate-600">{view?.patient.name ?? "Carregando cadastro…"}</p>
        </div>
        <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black" href={`/pacientes/${encodeURIComponent(patientId)}`}>Voltar ao prontuário</Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-black">Acesso individual</h2>
        <p className="mt-1 text-sm text-slate-600">
          {view?.linked ? "Conta do aluno ativa e vinculada a este cadastro." : "Nenhuma conta de aluno vinculada."}
        </p>
        {!view?.linked ? (
          <button className="mt-4 min-h-11 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={busy || !view} onClick={() => void invite()} type="button">Gerar convite individual</button>
        ) : null}
        {invitationPath ? (
          <label className="mt-4 block text-sm font-black">
            Endereço secreto de ativação — exibido somente agora
            <input className="mt-1 w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 font-mono text-xs" readOnly value={invitationPath} />
          </label>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-black">Conteúdos liberados</h2>
        <p className="mt-1 text-sm text-slate-600">Finalizar um documento não o publica automaticamente. Cada área permanece privada até a liberação abaixo.</p>
        <div className="mt-4 divide-y divide-slate-200">
          {areas.map(([contentType, label]) => (
            <label className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm font-bold" key={contentType}>
              <span>{label}</span>
              <input checked={view?.releases[contentType] ?? false} disabled={busy || !view} onChange={(event) => void toggle(contentType, event.target.checked)} type="checkbox" />
            </label>
          ))}
        </div>
      </section>
      {message ? <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold" role="status">{message}</p> : null}
    </main>
  );
}
