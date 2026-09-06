"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useT } from "@/lib/i18n/locale-context";

export function RegisterPageView() {
  const t = useT();

  return (
    <AuthShell
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      footer={
        <>
          {t.auth.hasAccount}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {t.auth.login}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
