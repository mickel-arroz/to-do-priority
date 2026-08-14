"use client";

import { Code2, Flame, Mail, User } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";

// Placeholders: el usuario proporcionará sus datos reales
const CREATOR_NAME = "{{CREATOR_NAME}}";
const CREATOR_EMAIL = "{{CREATOR_EMAIL}}";
const REPO_URL = "{{REPO_URL}}";

export default function AboutPage() {
  const t = useT();

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="about-page">
      <header className="glow-primary space-y-2 text-center">
        <Flame className="mx-auto size-10 text-primary" />
        <h1 className="gradient-text text-2xl font-bold">{t.about.title}</h1>
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
              <Mail className="size-4 text-on-strong" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{t.about.contact}</p>
              <a
                href={`mailto:${CREATOR_EMAIL}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {CREATOR_EMAIL}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="gradient-primary rounded-lg p-2">
              <Code2 className="size-4 text-on-strong" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{t.about.repository}</p>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary hover:underline"
              >
                {REPO_URL}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
