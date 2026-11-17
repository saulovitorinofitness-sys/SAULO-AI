import type {
  WorkoutExercise,
  WorkoutPlanDraft,
  WorkoutSession,
} from "./workout-contracts";

export type WorkoutSheetAction =
  | { readonly type: "ADD_SESSION"; readonly session: WorkoutSession }
  | { readonly type: "UPDATE_SESSION"; readonly sessionId: string; readonly change: Partial<WorkoutSession> }
  | { readonly type: "REMOVE_SESSION"; readonly sessionId: string }
  | { readonly type: "ADD_EXERCISE"; readonly sessionId: string; readonly exercise: WorkoutExercise }
  | { readonly type: "UPDATE_EXERCISE"; readonly sessionId: string; readonly exerciseId: string; readonly change: Partial<WorkoutExercise> }
  | { readonly type: "REMOVE_EXERCISE"; readonly sessionId: string; readonly exerciseId: string }
  | { readonly type: "MOVE_EXERCISE"; readonly sessionId: string; readonly exerciseId: string; readonly direction: -1 | 1 };

function reorder(exercises: readonly WorkoutExercise[]) {
  return exercises.map((exercise, index) => ({ ...exercise, order: index + 1 }));
}

export function workoutSheetReducer(
  draft: WorkoutPlanDraft,
  action: WorkoutSheetAction,
): WorkoutPlanDraft {
  if (action.type === "ADD_SESSION") {
    return { ...draft, sessions: [...draft.sessions, action.session] };
  }
  if (action.type === "REMOVE_SESSION") {
    return {
      ...draft,
      sessions: draft.sessions.filter((session) => session.id !== action.sessionId),
    };
  }
  return {
    ...draft,
    sessions: draft.sessions.map((session) => {
      if (session.id !== action.sessionId) return session;
      if (action.type === "UPDATE_SESSION") {
        return { ...session, ...action.change };
      }
      if (action.type === "ADD_EXERCISE") {
        return {
          ...session,
          exercises: reorder([...session.exercises, action.exercise]),
        };
      }
      if (action.type === "UPDATE_EXERCISE") {
        return {
          ...session,
          exercises: session.exercises.map((exercise) =>
            exercise.id === action.exerciseId
              ? { ...exercise, ...action.change }
              : exercise,
          ),
        };
      }
      if (action.type === "REMOVE_EXERCISE") {
        return {
          ...session,
          exercises: reorder(
            session.exercises.filter((exercise) => exercise.id !== action.exerciseId),
          ),
        };
      }
      const exercises = [...session.exercises];
      const index = exercises.findIndex((exercise) => exercise.id === action.exerciseId);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= exercises.length) return session;
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...session, exercises: reorder(exercises) };
    }),
  };
}
