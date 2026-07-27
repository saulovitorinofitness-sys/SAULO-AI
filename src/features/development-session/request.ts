import {
  DEVELOPMENT_PROFESSIONALS,
  DEVELOPMENT_USER_HEADER,
  DEVELOPMENT_USER_STORAGE_KEY,
  isDevelopmentUserKey,
} from "./config";

export function developmentUserRequestHeaders(): HeadersInit {
  if (
    typeof window === "undefined" ||
    process.env.NODE_ENV !== "development"
  ) {
    return {};
  }

  const key = window.localStorage.getItem(
    DEVELOPMENT_USER_STORAGE_KEY,
  );
  const professional = isDevelopmentUserKey(key)
    ? DEVELOPMENT_PROFESSIONALS[key]
    : DEVELOPMENT_PROFESSIONALS.saulo;

  return {
    [DEVELOPMENT_USER_HEADER]: professional.user.id,
  };
}
