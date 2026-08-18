"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoalReplace, Home, Info, PanelLeft, Plus } from "@/components/icons";
import { Logo } from "@/components/layout/Logo";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserMenu, type UserInfo } from "@/components/layout/UserMenu";
import { useT } from "@/lib/i18n/locale-context";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SidebarCategory = Category & { taskCount: number };

type SidebarProps = {
  user: UserInfo;
  categories: SidebarCategory[];
  onNewCategory: () => void;
};

/**
 * Two-state desktop sidebar: collapsed (icons only) by default. It only
 * expands to the full labelled view when the user clicks the toggle button
 * in the header — no hover/focus auto-expand.
 */
export function Sidebar({ user, categories, onNewCategory }: SidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const linkClass = (active: boolean) =>
    cn(
      "flex h-10 items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium transition-colors",
      // Collapsed: center the lone icon; expanded: pad for icon + label
      expanded ? "px-2.5" : "justify-center px-0",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <aside
      data-testid="sidebar"
      data-expanded={expanded}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar transition-[width] duration-200 ease-out md:flex",
        expanded ? "w-64 shadow-lg" : "w-16"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 overflow-hidden px-3",
          expanded
            ? "h-14 flex-row justify-between"
            : "h-auto flex-col justify-center gap-1 py-3"
        )}
      >
        {expanded ? (
          <Link
            href="/"
            className="flex items-center gap-2 truncate font-heading text-base font-bold"
            aria-label={t.nav.home}
          >
            <Logo className="size-6 shrink-0" />
            {t.common.appName}
          </Link>
        ) : (
          <Link
            href="/"
            className="flex size-9 items-center justify-center"
            aria-label={t.nav.home}
          >
            <Logo className="size-6 shrink-0" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={expanded ? t.nav.collapseSidebar : t.nav.expandSidebar}
          aria-expanded={expanded}
          data-testid="sidebar-toggle"
        >
          <PanelLeft className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        <Link href="/" className={linkClass(pathname === "/")} title={t.nav.home}>
          <Home className="size-5 shrink-0" />
          {expanded && <span>{t.nav.home}</span>}
        </Link>
        <Link
          href="/habits"
          className={linkClass(pathname.startsWith("/habits"))}
          title={t.nav.habits}
        >
          <GoalReplace className="size-5 shrink-0" />
          {expanded && <span>{t.nav.habits}</span>}
        </Link>

        <div className="pt-3">
          {expanded ? (
            <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.nav.lists}
            </p>
          ) : (
            <div className="mx-2.5 mb-2 border-t" />
          )}
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.id}`}
              className={linkClass(pathname === `/categories/${cat.id}`)}
              title={cat.name}
            >
              <CategoryIcon
                icon={cat.icon}
                color={cat.color}
                className="size-5 shrink-0"
              />
              {expanded && (
                <>
                  <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {cat.taskCount}
                  </Badge>
                </>
              )}
            </Link>
          ))}
          <button
            onClick={onNewCategory}
            className={cn(linkClass(false), "w-full text-muted-foreground")}
            title={t.nav.newList}
            data-testid="new-category"
          >
            <Plus className="size-5 shrink-0" />
            {expanded && <span>{t.nav.newList}</span>}
          </button>
        </div>
      </nav>

      <div className="space-y-2 overflow-hidden border-t p-2">
        <div
          className={cn(
            "flex gap-1",
            expanded
              ? "flex-row items-center justify-between px-1"
              : "flex-col items-center"
          )}
        >
          <ThemeToggle />
          <LanguageToggle />
          <Link
            href="/about"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-muted-foreground"
            title={t.nav.about}
            aria-label={t.nav.about}
            data-testid="about-link"
          >
            <Info className="size-4" />
          </Link>
        </div>
        <UserMenu user={user} collapsed={!expanded} />
      </div>
    </aside>
  );
}
