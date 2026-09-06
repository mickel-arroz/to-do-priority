"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormError } from "@/components/auth/FormError";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { api } from "@/lib/api/client";
import { authRequestFailure } from "@/lib/auth/errors";
import { useT } from "@/lib/i18n/locale-context";

export function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t.auth.passwordMismatch);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await api.auth.register(
        fullName,
        email,
        password
      );
      if (needsEmailConfirmation) {
        toast.success(t.auth.checkEmail);
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(authRequestFailure(err, t, t.auth.registerError).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <FormError message={error} />

      <GoogleButton onError={setError} />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          {t.auth.continueWith}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t.auth.fullName}</Label>
          <Input
            id="fullName"
            className="h-9"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            data-testid="name-input"
          />
        </div>
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
            minLength={8}
            autoComplete="new-password"
            data-testid="password-input"
          />
          <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t.auth.confirmPassword}</Label>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            data-testid="confirm-input"
          />
          {mismatch && (
            <p className="text-xs text-destructive">{t.auth.passwordMismatch}</p>
          )}
        </div>
        <LoadingButton
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          data-testid="register-submit"
        >
          {t.auth.register}
        </LoadingButton>
      </form>
    </div>
  );
}
