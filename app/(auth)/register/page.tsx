"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { toast } from "sonner";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t.auth.passwordMismatch);
      return;
    }
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
    } catch {
      toast.error(t.auth.registerError);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Logo className="mx-auto size-10" size={40} />
          <h1 className="text-3xl font-bold">{t.auth.registerTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.auth.registerSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t.auth.fullName}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              data-testid="name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              data-testid="email-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              data-testid="password-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t.auth.confirmPassword}</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              data-testid="confirm-input"
            />
          </div>
          <LoadingButton
            type="submit"
            className="w-full"
            loading={loading}
            data-testid="register-submit"
          >
            {t.auth.register}
          </LoadingButton>
        </form>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">·</span>
          <Separator className="flex-1" />
        </div>

        <GoogleButton />

        <p className="text-center text-sm text-muted-foreground">
          {t.auth.hasAccount}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t.auth.login}
          </Link>
        </p>
      </div>
    </main>
  );
}
