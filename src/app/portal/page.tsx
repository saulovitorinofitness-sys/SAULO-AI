import Link from "next/link";
import { redirect } from "next/navigation";

import { StudentPortalLogoutButton } from "@/components/student-portal/student-portal-logout-button";
import { STUDENT_PORTAL_EMPTY_MESSAGES } from "@/features/student-portal/contracts";
import {
  StudentPortalAccessError,
  studentPortalService,
} from "@/features/student-portal/service";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formattedDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : date.format(parsed);
}

function Empty({ children }: { readonly children: string }) {
  return <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">{children}</p>;
}

function Results({ value }: { readonly value: unknown }) {
  if (!value || typeof value !== "object") return <p className="text-sm">{String(value ?? "—")}</p>;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) =>
    ["string", "number", "boolean"].includes(typeof item),
  );
  if (!entries.length) return <p className="text-sm text-slate-600">Resultados estruturados disponíveis no documento.</p>;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {entries.map(([key, item]) => (
        <div className="rounded-lg bg-slate-50 p-2" key={key}>
          <dt className="break-words text-[10px] font-black uppercase tracking-wide text-slate-500">{key}</dt>
          <dd className="mt-1 break-words text-sm font-bold">{String(item)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function StudentPortalPage() {
  let dashboard: Awaited<ReturnType<typeof studentPortalService.getDashboard>>;
  try {
    dashboard = await studentPortalService.getDashboard();
  } catch (error) {
    if (error instanceof StudentPortalAccessError) {
      redirect(error.reason === "UNAUTHENTICATED" ? "/?returnTo=%2Fportal" : "/dashboard");
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-[#edf4f0] px-3 py-5 text-[#183029] sm:px-5">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="rounded-3xl bg-[#0a4938] p-5 text-white shadow-lg sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Clínica SV · Portal do Aluno</p>
              <h1 className="mt-2 text-2xl font-black">Olá, {dashboard.student.name}</h1>
              <p className="mt-1 text-sm text-emerald-100">Cadastro {dashboard.student.code}</p>
            </div>
            <StudentPortalLogoutButton />
          </div>
        </header>

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">Minha dieta</h2>
          {!dashboard.diet ? <Empty>{STUDENT_PORTAL_EMPTY_MESSAGES.diet}</Empty> : (
            <div className="mt-3 space-y-3">
              {dashboard.diet.meals.map((meal) => (
                <article className="rounded-xl border border-slate-200 p-4" key={meal.id}>
                  <div className="flex items-baseline justify-between gap-3"><h3 className="font-black">{meal.name}</h3>{meal.time ? <span className="text-sm font-bold text-emerald-700">{meal.time}</span> : null}</div>
                  <ul className="mt-3 space-y-3">
                    {meal.items.map((item) => <li className="text-sm" key={item.id}><p><strong>{item.name}</strong> · {item.portion || "Porção conforme orientação"}</p>{item.substitutions.length ? <p className="mt-1 text-xs text-slate-600">Substituições: {item.substitutions.join("; ")}</p> : null}</li>)}
                  </ul>
                  {meal.orientation ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm"><strong>Orientação:</strong> {meal.orientation}</p> : null}
                </article>
              ))}
              {dashboard.diet.orientations.length ? <div className="rounded-xl bg-amber-50 p-4 text-sm"><strong>Orientações adicionais</strong><ul className="mt-2 list-disc space-y-1 pl-5">{dashboard.diet.orientations.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">Meu treino</h2>
          {!dashboard.workout ? <Empty>{STUDENT_PORTAL_EMPTY_MESSAGES.workout}</Empty> : (
            <div className="mt-3 space-y-4">
              {(dashboard.workout.currentPhase || dashboard.workout.currentFocus || dashboard.workout.nextPhase || dashboard.workout.nextFocus) ? <div className="grid grid-cols-2 gap-2 rounded-xl bg-emerald-50 p-3 text-sm"><p><strong>Fase atual:</strong><br />{dashboard.workout.currentPhase ?? "—"}</p><p><strong>Foco atual:</strong><br />{dashboard.workout.currentFocus ?? "—"}</p><p><strong>Próxima fase:</strong><br />{dashboard.workout.nextPhase ?? "—"}</p><p><strong>Próximo foco:</strong><br />{dashboard.workout.nextFocus ?? "—"}</p></div> : null}
              {dashboard.workout.journey.length ? <div className="rounded-xl border border-emerald-100 p-4"><h3 className="font-black">Percurso registrado</h3><ol className="mt-3 space-y-3">{dashboard.workout.journey.map((transition, index) => <li className="border-l-2 border-emerald-600 pl-3 text-sm" key={`${transition.effectiveDate}-${index}`}><time className="font-bold text-emerald-800">{formattedDate(transition.effectiveDate)}</time>{transition.phaseBefore || transition.phaseAfter ? <p>Fase: {transition.phaseBefore ?? "—"} → {transition.phaseAfter ?? "—"}</p> : null}{transition.focusBefore || transition.focusAfter ? <p>Foco: {transition.focusBefore ?? "—"} → {transition.focusAfter ?? "—"}</p> : null}</li>)}</ol></div> : null}
              {dashboard.workout.sessions.map((session) => <article className="rounded-xl border border-slate-200 p-4" key={session.id}><h3 className="text-lg font-black">{session.name}</h3>{session.objective ? <p className="mt-1 text-sm text-slate-600">{session.objective}</p> : null}<div className="mt-3 space-y-3">{session.exercises.map((exercise) => <div className="rounded-lg bg-slate-50 p-3" key={exercise.id}><p className="font-black">{exercise.name}</p><dl className="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-slate-500">Séries</dt><dd className="font-bold">{exercise.sets ?? "—"}</dd></div><div><dt className="text-xs text-slate-500">Repetições</dt><dd className="font-bold">{exercise.repetitions ?? "—"}</dd></div><div><dt className="text-xs text-slate-500">Carga</dt><dd className="font-bold">{exercise.load ?? "—"}</dd></div><div><dt className="text-xs text-slate-500">Intervalo</dt><dd className="font-bold">{exercise.restInterval ?? "—"}</dd></div></dl>{exercise.instruction ? <p className="mt-2 text-xs text-slate-600">{exercise.instruction}</p> : null}</div>)}</div></article>)}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">Minhas avaliações</h2>
          {!dashboard.assessments || !dashboard.assessments.items.length ? <Empty>{STUDENT_PORTAL_EMPTY_MESSAGES.assessments}</Empty> : <div className="mt-3 space-y-3">{dashboard.assessments.items.map((assessment) => <article className="rounded-xl border border-slate-200 p-4" key={assessment.id}><div className="mb-3 flex justify-between gap-3"><h3 className="font-black">{assessment.kind.replaceAll("_", " ")}</h3><time className="text-sm font-bold text-slate-600">{formattedDate(assessment.performedAt)}</time></div><Results value={assessment.results} /></article>)}{dashboard.assessments.posturalEvolution.map((evolution) => <article className="rounded-xl bg-emerald-50 p-4 text-sm" key={`${evolution.previousDate}-${evolution.currentDate}`}><p className="font-black">Evolução: {formattedDate(evolution.previousDate)} → {formattedDate(evolution.currentDate)}</p>{evolution.summary ? <p className="mt-2">{evolution.summary}</p> : null}</article>)}</div>}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">Meus pagamentos</h2>
          {!dashboard.payments || !dashboard.payments.length ? <Empty>{STUDENT_PORTAL_EMPTY_MESSAGES.payments}</Empty> : <div className="mt-3 space-y-3">{dashboard.payments.map((payment) => <article className="rounded-xl border border-slate-200 p-4" key={payment.id}><p className="font-black">{payment.services.join(" · ") || "Serviço da Clínica SV"}</p><dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3"><div><dt className="text-xs text-slate-500">Valor</dt><dd className="font-bold">{money.format(Number(payment.amount))}</dd></div><div><dt className="text-xs text-slate-500">Vencimento</dt><dd className="font-bold">{payment.dueDate ? formattedDate(payment.dueDate) : "—"}</dd></div><div><dt className="text-xs text-slate-500">Situação</dt><dd className="font-bold">{payment.status}</dd></div></dl>{payment.receiptId ? <Link className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-emerald-700 px-3 text-sm font-black text-emerald-800" href={`/portal/recibos/${encodeURIComponent(payment.receiptId)}`}>Ver recibo</Link> : null}</article>)}</div>}
        </section>
      </div>
    </main>
  );
}
