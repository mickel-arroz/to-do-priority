"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/auth/FormError";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { api } from "@/lib/api/client";
import {
  authRequestFailure,
  callbackErrorMessage,
  type AuthFailure,
} from "@/lib/auth/errors";
import { useT } from "@/lib/i18n/locale-context";

export function LoginForm({ initialError }: { initialError?: string }) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(() => {
    const message = callbackErrorMessage(initialError, t);
    return message ? { message, invalidCredentials: false } : null;
  });

  // El `?error=` ya está en pantalla: lo quitamos de la barra de direcciones
  // para que recargar no lo resucite ni el usuario lo comparta por accidente.
  useEffect(() => {
    if (initialError) window.history.replaceState(null, "", "/login");
  }, [initialError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    setLoading(true);
    try {
      await api.auth.login(email, password);
      router.push("/");
      router.refresh();
    } catch (err) {
      setFailure(authRequestFailure(err, t, t.auth.loginError));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <FormError message={failure?.message ?? null} />

      <GoogleButton
        onError={(message) => setFailure({ message, invalidCredentials: false })}
      />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          {t.auth.continueWith}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input
            id="email"
            type="email"
            className="h-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            aria-invalid={failure?.invalidCredentials || undefined}
            data-testid="email-input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.auth.password}</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            aria-invalid={failure?.invalidCredentials || undefined}
            data-testid="password-input"
          />
        </div>
        <LoadingButton
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          data-testid="login-submit"
        >
          {t.auth.login}
        </LoadingButton>
      </form>
    </div>
  );
}
