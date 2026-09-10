"use client";

import { useState } from "react";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { Sidebar, type SidebarCategory } from "@/components/layout/Sidebar";
import type { UserInfo } from "@/components/layout/UserMenu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n/locale-context";
import { notifyModalNavigation } from "@/hooks/useModalHistory";

type AppShellProps = {
  user: UserInfo;
  categories: SidebarCategory[];
  children: React.ReactNode;
};

export function AppShell({ user, categories, children }: AppShellProps) {
  const t = useT();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <Sidebar
        user={user}
        categories={categories}
        onNewCategory={() => setCategoryDialogOpen(true)}
      />

      {/* Content leaves room for the collapsed sidebar (desktop) and the
          bottom navbar (mobile) */}
      <main className="flex-1 pb-[var(--bottom-nav-h)] md:pb-0 md:pl-16">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">{children}</div>
      </main>

      {/* Mobile: bottom navbar; the menu is a sheet the button toggles
          open and closed */}
      <BottomNav menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((o) => !o)} />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        {/* El menú llega hasta arriba pero se detiene sobre la barra inferior:
            así no queda fondo visible y el botón Menú sigue a mano para
            cerrarlo con un segundo toque. */}
        <SheetContent
          side="bottom"
          className="top-0 bottom-[var(--bottom-nav-h)] h-auto overflow-y-auto rounded-none pb-4"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{t.nav.menu}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <MobileMenu
              user={user}
              categories={categories}
              onNavigate={() => {
                // El <Link> va a navegar: el centinela del sheet se abandona
                // en vez de gastarse, para que el salto no caiga ya sobre la
                // ruta nueva y eche al usuario de ella.
                notifyModalNavigation();
                setMenuOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />
    </div>
  );
}
