"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { SessionUser } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

import {
  developmentProfessionalFromUserId,
  type DevelopmentProfessional,
  type DevelopmentUserKey,
} from "./config";

interface DevelopmentSessionValue {
  readonly professional: DevelopmentProfessional;
  readonly selectUser: (key: DevelopmentUserKey) => void;
}

const DevelopmentSessionContext =
  createContext<DevelopmentSessionValue | null>(null);

function neutralProfessional(user: SessionUser): DevelopmentProfessional {
  return {
    key: "maria",
    user,
    functionName: user.roleName,
    access: {
      user,
      grantsAllModules: false,
      allowsNutritionModules: false,
      overrides: [],
    },
  };
}

export function DevelopmentSessionProvider({
  children,
  initialUser,
}: {
  readonly children: ReactNode;
  readonly initialUser: SessionUser;
}) {
  const value = useMemo(
    () => {
      const knownUser =
        initialUser.id === BUILT_IN_IDS.users.sauloXavierVitorino ||
        initialUser.id === BUILT_IN_IDS.users.mariaDeLourdesGomes;
      const template = knownUser
        ? developmentProfessionalFromUserId(initialUser.id)
        : neutralProfessional(initialUser);
      const professional = {
        ...template,
        user: initialUser,
        functionName: initialUser.roleName,
        access: {
          ...template.access,
          user: initialUser,
        },
      } satisfies DevelopmentProfessional;

      return {
        professional,
        selectUser: (key: DevelopmentUserKey) => {
          void key;
        },
      };
    },
    [initialUser],
  );

  return (
    <DevelopmentSessionContext.Provider value={value}>
      {children}
    </DevelopmentSessionContext.Provider>
  );
}

export function useDevelopmentSession() {
  const context = useContext(DevelopmentSessionContext);

  if (!context) {
    throw new Error(
      "useDevelopmentSession deve ser usado dentro de DevelopmentSessionProvider.",
    );
  }

  return context;
}
