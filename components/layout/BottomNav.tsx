"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoalReplace, Home, ListDetails, Menu } from "@/components/icons";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type BottomNavProps = {
  menuOpen: boolean;
  onToggleMenu: () => void;
};

/**
 * Mobile bottom navigation: Home · Hábitos · Listas · Menú. The menu
 * button toggles the sheet open AND closed on a second tap.
 */
export function BottomNav({ menuOpen, onToggleMenu }: BottomNavProps) {
  const t = useT();
  const pathname = usePathname();

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link href="/" className={itemClass(!menuOpen && pathname === "/")}>
        <Home className="size-5" />
        {t.nav.home}
      </Link>
      <Link
        href="/habits"
        className={itemClass(!menuOpen && pathname.startsWith("/habits"))}
      >
        <GoalReplace className="size-5" />
        {t.nav.habits}
      </Link>
      <Link
        href="/lists"
        className={itemClass(
          !menuOpen &&
            (pathname === "/lists" || pathname.startsWith("/categories"))
        )}
        data-testid="nav-lists"
      >
        <ListDetails className="size-5" />
        {t.nav.lists}
      </Link>
      <button
        onClick={onToggleMenu}
        className={itemClass(menuOpen)}
        aria-expanded={menuOpen}
        data-testid="nav-menu"
      >
        <Menu className="size-5" />
        {t.nav.menu}
      </button>
    </nav>
  );
}
