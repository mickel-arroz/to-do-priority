"use client";

import { Github, Linkedin, User } from "@/components/icons";
import { Logo } from "@/components/layout/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";

const CREATOR_NAME = "Mickel Arroz";
const LINKEDIN_URL = "https://www.linkedin.com/in/mickel-arroz";
const REPO_URL = "https://github.com/mickel-arroz/to-do-priority";

export default function AboutPage() {
  const t = useT();

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="about-page">
      <header className="space-y-2 text-center">
        <Logo className="mx-auto size-10" size={40} />
        <h1 className="gradient-text text-3xl font-bold">{t.about.title}</h1>
      </header>

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        {t.about.projectDescription}
      </p>

      <Card className="gradient-card">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="gradient-primary rounded-lg p-2">
              <User className="size-4 text-on-strong" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{t.about.creator}</p>
              <p className="text-sm font-medium">{CREATOR_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="gradient-primary rounded-lg p-2">
              <Linkedin className="size-4 text-on-strong" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{t.about.contact}</p>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary hover:underline"
              >
                linkedin.com/in/mickel-arroz
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="gradient-primary rounded-lg p-2">
              <Github className="size-4 text-on-strong" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{t.about.repository}</p>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary hover:underline"
              >
                github.com/mickel-arroz/to-do-priority
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
