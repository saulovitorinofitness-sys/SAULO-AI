"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";

type LogoutState = "closing" | "failed";

export default function LogoutPage() {
  const router = useRouter();
  const requestStartedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LogoutState>("closing");

  useEffect(() => {
    if (requestStartedRef.current) return;
    requestStartedRef.current = true;

    void fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      })
      .then(() => {
        router.replace("/");
        router.refresh();
      })
      .catch(() => {
        requestStartedRef.current = false;
        setState("failed");
      });
  }, [attempt, router]);

  function returnToLogin() {
    router.replace("/");
    router.refresh();
  }

  function retryLogout() {
    setState("closing");
    setAttempt((current) => current + 1);
  }

  return (
    <>
      <PageHeading
        description="Finalizando o acesso atual com segurança."
        eyebrow="Sessão"
        title="Sair do SAULO AI"
      />

      <Card
        aria-live="polite"
        className="max-w-2xl px-6 py-10 text-center sm:px-10 sm:py-12"
        role={state === "failed" ? "alert" : "status"}
        variant={state === "failed" ? "danger" : "default"}
      >
        {state === "closing" ? (
          <>
            <span
              aria-hidden="true"
              className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--brand-soft)]"
            >
              <span className="size-5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-r-[var(--primary)]" />
            </span>
            <h2 className="mt-5 text-lg font-black text-[var(--text-primary)]">
              Encerrando sessão...
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Aguarde enquanto concluímos sua saída do sistema.
            </p>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="mx-auto grid size-12 place-items-center rounded-full bg-rose-100 text-lg font-black text-rose-700"
            >
              !
            </span>
            <h2 className="mt-5 text-lg font-black text-rose-950">
              Não foi possível concluir a saída
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-rose-800">
              Verifique sua conexão e tente novamente. Você também pode voltar à tela de login.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={retryLogout} type="button">
                Tentar novamente
              </Button>
              <Button onClick={returnToLogin} type="button" variant="outline">
                Voltar à tela de login
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
