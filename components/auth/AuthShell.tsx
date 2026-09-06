"use client";

import { Flame, ListChecks, Timer } from "@/components/icons";
import { Logo } from "@/components/layout/Logo";
import { useT } from "@/lib/i18n/locale-context";

/**
 * Marco de las pantallas de acceso: panel de marca a la izquierda (solo en
 * pantallas grandes) y la tarjeta del formulario a la derecha. Ambas caras son
 * opacas a propósito: la retícula global de fondo no debe verse a través de
 * ellas.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useT();

  const features = [
    {
      icon: ListChecks,
      title: t.auth.featureMatrixTitle,
      description: t.auth.featureMatrixDesc,
    },
    {
      icon: Flame,
      title: t.auth.featureHabitsTitle,
      description: t.auth.featureHabitsDesc,
    },
    {
      icon: Timer,
      title: t.auth.featurePomodoroTitle,
      description: t.auth.featurePomodoroDesc,
    },
  ];

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="gradient-auth-panel relative hidden overflow-hidden border-r border-border bg-card p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="relative flex items-center gap-2">
          <Logo className="size-8" size={32} />
          <span className="font-heading text-lg font-semibold tracking-tight">
            {t.common.appName}
          </span>
        </div>

        <div className="relative space-y-8">
          <p className="max-w-md text-balance font-heading text-4xl leading-tight font-bold">
            {t.auth.brandTagline}
          </p>
          <ul className="space-y-4">
            {features.map(({ icon: Icon, title: name, description }) => (
              <li key={name} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          {t.common.appName}
        </p>
      </aside>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 space-y-2 text-center">
              <Logo className="mx-auto size-9 lg:hidden" size={36} />
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
