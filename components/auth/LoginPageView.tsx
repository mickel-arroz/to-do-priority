"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { useT } from "@/lib/i18n/locale-context";

export function LoginPageView({ initialError }: { initialError?: string }) {
  const t = useT();

  return (
    <AuthShell
      title={t.auth.welcomeTitle}
      subtitle={t.auth.welcomeSubtitle}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            {t.auth.register}
          </Link>
        </>
      }
    >
      <LoginForm initialError={initialError} />
    </AuthShell>
  );
}
