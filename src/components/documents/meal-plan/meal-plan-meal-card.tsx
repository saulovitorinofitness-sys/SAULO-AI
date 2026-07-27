import {
  mealNutrition,
  type AssistedPreviewMeal,
  type MealPlanMeal,
} from "@/features/meal-plan";

const number = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

export function MealPlanMealCard({
  meal,
  planMeal,
}: {
  meal: AssistedPreviewMeal;
  planMeal?: MealPlanMeal;
}) {
  const nutrition = mealNutrition(meal);

  return (
    <article className="pdf-avoid-break rounded-xl border border-[#dbe5e0] bg-white p-4">
      <div className="flex items-start justify-between gap-4 border-b border-[#e7ece9] pb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#a17d2e]">
            {meal.time}
          </p>
          <h3 className="mt-1 text-sm font-black text-[#243b33]">
            {meal.name}
          </h3>
        </div>

        <div className="text-right">
          <p className="text-xs font-black text-[#17644c]">
            {number.format(nutrition.calories)} kcal
          </p>
          <p className="mt-1 text-[8px] font-bold text-[#718079]">
            P {number.format(nutrition.proteinGrams)} g · C{" "}
            {number.format(nutrition.carbohydratesGrams)} g · L{" "}
            {number.format(nutrition.fatsGrams)} g
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-[#e7ece9]">
        <div className="grid grid-cols-[minmax(0,1fr)_0.65fr_0.55fr] bg-[#f3f7f5] px-3 py-2 text-[8px] font-black uppercase tracking-wide text-[#60746d]">
          <span>Alimento</span>
          <span>Quantidade</span>
          <span className="text-right">Gramagem</span>
        </div>

        {meal.foods.map((food) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_0.65fr_0.55fr] gap-2 border-t border-[#edf1ef] px-3 py-2 text-[9px] leading-4 text-[#3f544c]"
            key={food.id}
          >
            <span className="font-bold text-[#293f37]">{food.name}</span>
            <span>
              {number.format(food.quantity)} {food.householdMeasure}
            </span>
            <span className="text-right">{number.format(food.grams)} g</span>
          </div>
        ))}
      </div>

      {planMeal?.observations ? (
        <p className="mt-3 text-[9px] leading-4 text-[#60746d]">
          <strong className="text-[#40564e]">Observações:</strong>{" "}
          {planMeal.observations}
        </p>
      ) : null}
    </article>
  );
}
