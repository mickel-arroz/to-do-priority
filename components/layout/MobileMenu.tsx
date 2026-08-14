"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Info, LogOut, Plus, Target } from "@/components/icons";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { SidebarCategory } from "@/components/layout/Sidebar";
import type { UserInfo } from "@/components/layout/UserMenu";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";

type MobileMenuProps = {
  user: UserInfo;
  categories: SidebarCategory[];
  /** Called when the user navigates away (closes the sheet) */
  onNavigate?: () => void;
};

/** "See more" menu content, shown in a bottom sheet from the mobile navbar. */
export function MobileMenu({ user, categories, onNavigate }: MobileMenuProps) {
  const t = useT();
  const router = useRouter();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await api.auth.signout();
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const itemClass =
    "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-accent";

  return (
    <div className="space-y-6" data-testid="mobile-menu">
      <nav className="space-y-1">
        <Link href="/" className={itemClass} onClick={onNavigate}>
          <Home className="size-5" />
          {t.nav.home}
        </Link>
        <Link href="/habits" className={itemClass} onClick={onNavigate}>
          <Target className="size-5" />
          {t.nav.habits}
        </Link>
      </nav>

      <div>
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.nav.lists}
        </p>
        <nav className="space-y-1">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.id}`}
              className={itemClass}
              onClick={onNavigate}
            >
              <CategoryIcon icon={cat.icon} color={cat.color} className="size-5" />
              <span className="min-w-0 flex-1 truncate">
                {cat.is_default ? t.categories.general : cat.name}
              </span>
              <Badge variant="secondary">{cat.taskCount}</Badge>
            </Link>
          ))}
          <button
            onClick={() => setCategoryDialogOpen(true)}
            className={`${itemClass} w-full text-muted-foreground`}
          >
            <Plus className="size-5" />
            {t.nav.newList}
          </button>
        </nav>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <Link
          href="/about"
          aria-label={t.nav.about}
          onClick={onNavigate}
          className="p-2 text-muted-foreground/50 hover:text-muted-foreground"
        >
          <Info className="size-4" />
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback>{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Separator className="my-4" />
          <LoadingButton
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={handleSignOut}
            loading={signingOut}
            data-testid="sign-out"
          >
            {!signingOut && <LogOut className="size-4" />}
            {t.auth.signOut}
          </LoadingButton>
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />
    </div>
  );
}
