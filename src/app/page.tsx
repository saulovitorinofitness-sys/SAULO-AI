"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { AUTHENTICATED_HOME, safeReturnTo } from "@/features/mvp/authentication-navigation";

function intendedDestination() {
  if (typeof window === "undefined") return AUTHENTICATED_HOME;
  return safeReturnTo(new URLSearchParams(window.location.search).get("returnTo")) ?? AUTHENTICATED_HOME;
}

function authenticatedDestination(homePath: unknown) {
  return homePath === "/portal" ? "/portal" : intendedDestination();
}

function loginErrorMessage(status: number) {
  if (status === 401) {
    return "Usuário ou senha inválidos.";
  }

  if (status === 403) {
    return "Este usuário está inativo. Procure o administrador do sistema.";
  }

  if (status === 400) {
    return "Confira o usuário e a senha informados.";
  }

  return "Não foi possível entrar agora. Tente novamente em instantes.";
}

function InstitutionalBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3.5" aria-label="Clínica SV — Prontuário Integrado">
      <span
        aria-hidden="true"
        className={`relative grid size-12 shrink-0 place-items-center rounded-2xl border text-sm font-black tracking-[-0.02em] shadow-lg sm:size-14 sm:text-base ${
          inverse
            ? "border-white/15 bg-white/10 text-white shadow-black/15"
            : "border-[#d8e7e0] bg-[linear-gradient(145deg,#12664f,#0a4938)] text-white shadow-emerald-950/15"
        }`}
      >
        SV
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-current bg-[#d6bc70]" />
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-base font-black tracking-[-0.02em] sm:text-lg ${
            inverse ? "text-white" : "text-[#183029]"
          }`}
        >
          Clínica SV
        </span>
        <span
          className={`mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.18em] ${
            inverse ? "text-emerald-100/70" : "text-[#71827b]"
          }`}
        >
          Prontuário Integrado
        </span>
      </span>
    </div>
  );
}

function InstitutionalPillars() {
  return (
    <div aria-label="Áreas integradas" className="flex flex-wrap gap-2">
      {["Nutrição", "Performance", "Gestão integrada"].map((label) => (
        <span
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-bold text-emerald-50/80 backdrop-blur-sm"
          key={label}
        >
          <span aria-hidden="true" className="size-1 rounded-full bg-[#d6bc70]" />
          {label}
        </span>
      ))}
    </div>
  );
}

function SessionCheck() {
  return (
    <div
      aria-label="Verificando sessão"
      aria-live="polite"
      className="flex min-h-48 flex-col items-center justify-center gap-4 text-sm font-bold text-[var(--muted)]"
      role="status"
    >
      <span className="grid size-11 place-items-center rounded-2xl border border-[#dbe8e2] bg-[#f4f9f6] shadow-sm">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-r-[var(--primary)]"
        />
      </span>
      Verificando sessão…
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (response.ok) {
          const session = (await response.json().catch(() => null)) as
            | { homePath?: string }
            | null;
          router.replace(authenticatedDestination(session?.homePath));
          router.refresh();
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      if (!controller.signal.aborted) {
        setCheckingSession(false);
      }
    }

    void checkSession();

    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (!response.ok) {
        setError(loginErrorMessage(response.status));
        return;
      }

      const session = (await response.json().catch(() => null)) as
        | { homePath?: string }
        | null;
      setPassword("");
      router.replace(authenticatedDestination(session?.homePath));
      router.refresh();
    } catch {
      setError("Não foi possível entrar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#edf4f0] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 size-[28rem] rounded-full bg-[#b8d7c9]/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 -right-32 size-[34rem] rounded-full bg-[#d8c88f]/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(18,102,79,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(18,102,79,0.035)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-[0_32px_90px_rgba(18,66,52,0.18)] backdrop-blur-xl lg:min-h-[43rem] lg:grid-cols-[minmax(0,1.12fr)_minmax(25rem,0.88fr)]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#082f26_0%,#0a4938_55%,#12664f_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div aria-hidden="true" className="absolute -right-24 -top-28 size-96 rounded-full border border-[#d6bc70]/20" />
          <div aria-hidden="true" className="absolute -right-6 -top-8 size-64 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute bottom-24 left-16 h-px w-52 bg-gradient-to-r from-[#d6bc70]/60 to-transparent" />
          <div aria-hidden="true" className="absolute bottom-16 right-16 size-2 rounded-full bg-[#d6bc70]/70 shadow-[0_0_32px_8px_rgba(214,188,112,0.22)]" />

          <div className="relative z-10">
            <InstitutionalBrand inverse />

            <div className="mt-20 max-w-xl">
              <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-[#d6bc70]">
                <span aria-hidden="true" className="h-px w-8 bg-[#d6bc70]/70" />
                Cuidado conectado
              </p>
              <h1 className="mt-6 text-[2.7rem] font-black leading-[1.08] tracking-[-0.045em] xl:text-5xl">
                Ciência e cuidado em uma visão integrada.
              </h1>
              <p className="mt-6 max-w-lg text-[15px] leading-7 text-emerald-50/72">
                Continuidade clínica, decisões mais claras e performance acompanhada em um único ambiente profissional.
              </p>
            </div>
          </div>

          <div className="relative z-10">
            <InstitutionalPillars />
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/55">
              <span>Acesso profissional</span>
              <span>Ambiente restrito</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="login-title" className="relative flex flex-col justify-center bg-[linear-gradient(155deg,#ffffff_0%,#fbfdfc_62%,#f3f8f5_100%)] px-6 py-8 sm:px-10 sm:py-12 lg:px-12 xl:px-16">
          <div aria-hidden="true" className="absolute right-0 top-0 h-32 w-32 rounded-bl-[5rem] border-b border-l border-[#d6bc70]/20 bg-[#f8f6ee]/55" />
          <div className="relative z-10 mx-auto w-full max-w-sm">
            <InstitutionalBrand />

            <div className="mt-6 flex gap-1.5 lg:hidden" aria-hidden="true">
              <span className="h-1 w-8 rounded-full bg-[var(--primary)]" />
              <span className="h-1 w-3 rounded-full bg-[#d6bc70]" />
              <span className="h-1 w-3 rounded-full bg-[#dbe8e2]" />
            </div>

            {checkingSession ? (
              <SessionCheck />
            ) : (
              <>
                <div className="mt-10 sm:mt-12">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)]">
                    Acesso seguro
                  </p>
                  <h2 className="mt-2.5 text-3xl font-black tracking-[-0.035em] text-[var(--text-primary)]" id="login-title">
                    Boas-vindas
                  </h2>
                  <p className="mt-2.5 text-sm leading-6 text-[var(--text-secondary)]">
                    Entre com sua credencial para continuar.
                  </p>
                </div>

                <form className="mt-8 space-y-5" noValidate onSubmit={submitLogin}>
                  <div>
                    <label className="block text-[13px] font-black text-[var(--text-primary)]" htmlFor="login-user">
                      Usuário
                    </label>
                    <input
                      aria-describedby={error ? "login-error" : undefined}
                      aria-invalid={Boolean(error)}
                      autoCapitalize="none"
                      autoComplete="username"
                      autoCorrect="off"
                      className="mt-2 min-h-12 w-full rounded-xl border border-[#cddcd5] bg-[#fbfdfc] px-4 text-base text-[var(--text-primary)] shadow-[0_4px_14px_rgba(20,55,44,0.035)] transition duration-200 placeholder:text-slate-400 hover:border-[#91b7a8] focus:border-[var(--primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#12664f]/10 disabled:cursor-not-allowed disabled:bg-[var(--surface-elevated)] sm:text-sm"
                      disabled={submitting}
                      id="login-user"
                      maxLength={254}
                      name="login"
                      onChange={(event) => {
                        setLogin(event.target.value);
                        if (error) setError(null);
                      }}
                      required
                      spellCheck={false}
                      type="text"
                      value={login}
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-black text-[var(--text-primary)]" htmlFor="login-password">
                      Senha
                    </label>
                    <div className="relative mt-2">
                      <input
                        aria-describedby={error ? "login-error" : undefined}
                        aria-invalid={Boolean(error)}
                        autoComplete="current-password"
                        className="min-h-12 w-full rounded-xl border border-[#cddcd5] bg-[#fbfdfc] px-4 pr-12 text-base text-[var(--text-primary)] shadow-[0_4px_14px_rgba(20,55,44,0.035)] transition duration-200 placeholder:text-slate-400 hover:border-[#91b7a8] focus:border-[var(--primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#12664f]/10 disabled:cursor-not-allowed disabled:bg-[var(--surface-elevated)] sm:text-sm"
                        disabled={submitting}
                        id="login-password"
                        maxLength={128}
                        name="password"
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (error) setError(null);
                        }}
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                      />
                      <button
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-slate-500 transition hover:bg-[#edf5f1] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={submitting}
                        onClick={() => setShowPassword((visible) => !visible)}
                        title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" className="size-[18px]" />
                        ) : (
                          <Eye aria-hidden="true" className="size-[18px]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <p className="rounded-xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm font-semibold leading-5 text-rose-800 outline-none shadow-sm" id="login-error" ref={errorRef} role="alert" tabIndex={-1}>
                      {error}
                    </p>
                  ) : null}

                  <Button
                    className="w-full shadow-[0_12px_26px_rgba(10,73,56,0.2)] hover:shadow-[0_14px_30px_rgba(10,73,56,0.26)]"
                    disabled={!login.trim() || !password || submitting}
                    loading={submitting}
                    size="large"
                    type="submit"
                  >
                    {submitting ? "Entrando…" : "Entrar"}
                  </Button>
                </form>

                <div className="mt-8 border-t border-[var(--line)] pt-5">
                  <p className="text-center text-[11px] leading-5 text-[var(--muted)]">
                    A senha é usada somente para autenticar este acesso e não é salva pela aplicação neste dispositivo.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
