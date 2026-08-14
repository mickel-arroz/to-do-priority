"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Home, Info, Plus, Target } from "@/components/icons";
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
 * Two-state desktop sidebar: collapsed (icons only) by default, expands
 * while the pointer or keyboard focus is inside it, giving the tasks the
 * space and emphasis.
 */
export function Sidebar({ user, categories, onNewCategory }: SidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const linkClass = (active: boolean) =>
    cn(
      "flex h-10 items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors",
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
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false);
      }}
    >
      <div className="flex h-14 items-center gap-2 overflow-hidden px-3">
        <Flame className="size-6 shrink-0 text-primary" />
        {expanded && (
          <span className="truncate font-heading text-base font-bold">
            {t.common.appName}
          </span>
        )}
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
          <Target className="size-5 shrink-0" />
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
        {expanded ? (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            <Link
              href="/about"
              className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              title={t.nav.about}
              data-testid="about-link"
            >
              <Info className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}
        <UserMenu user={user} collapsed={!expanded} />
      </div>
    </aside>
  );
}
