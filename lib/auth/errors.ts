import { ApiError } from "@/lib/api/client";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Traduce el `?error=` con el que /auth/callback devuelve al usuario a /login.
 * Los códigos los produce ese route handler; cualquier otro cae en el genérico.
 */
export function callbackErrorMessage(
  code: string | null | undefined,
  t: Dictionary
): string | null {
  if (!code) return null;
  switch (code) {
    case "oauth":
      return t.auth.oauthError;
    case "missing_code":
    case "exchange":
    case "auth":
      return t.auth.sessionError;
    default:
      return t.common.error;
  }
}

export type AuthFailure = {
  message: string;
  /** El fallo señala a los campos del formulario, no al entorno */
  invalidCredentials: boolean;
};

/**
 * Traduce el fallo de una llamada a /api/auth/*. `invalidCredentials` es el
 * texto para el rechazo propio de cada pantalla (login o registro).
 */
export function authRequestFailure(
  error: unknown,
  t: Dictionary,
  invalidCredentials: string
): AuthFailure {
  // fetch sólo rechaza cuando la petición ni siquiera llegó a salir
  if (!(error instanceof ApiError)) {
    return { message: t.auth.networkError, invalidCredentials: false };
  }
  if (error.status === 401 || error.status === 400) {
    return { message: invalidCredentials, invalidCredentials: true };
  }
  return { message: t.common.error, invalidCredentials: false };
}
