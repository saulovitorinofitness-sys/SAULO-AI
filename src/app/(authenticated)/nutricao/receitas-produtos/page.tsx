import type { Metadata } from "next";

import { RecipesProductsWorkspace } from "@/components/recipes/recipes-products-workspace";
import { PageState } from "@/components/ui";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Receitas e Produtos" };

export default async function RecipesProductsPage() {
  const access = await mvpService.getSession();

  if (!canAccess(access, "MEAL_PLAN", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso ao módulo de Receitas e Produtos."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  return <RecipesProductsWorkspace />;
}
