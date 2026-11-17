import { redirect } from "next/navigation";

export default async function LegacyNutritionFollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const scenario = query.scenario
    ? `?scenario=${encodeURIComponent(query.scenario)}`
    : "";
  redirect(`/pacientes/${patientId}/evolucao-avaliacoes${scenario}`);
}
