"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "@/components/icons";
import { AvailabilityDialog } from "@/components/availability/AvailabilityDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export type UserInfo = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export function UserMenu({
  user,
  collapsed = false,
}: {
  user: UserInfo;
  collapsed?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  // El popover se controla para poder cerrarlo al abrir la modal: dejar el
  // menu abierto detras de ella confunde el foco.
  const [menuOpen, setMenuOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

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

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent",
              collapsed && "justify-center"
            )}
            data-testid="user-menu-trigger"
          >
            <Avatar className="size-8 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-64">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback>{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Separator className="my-3" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              setMenuOpen(false);
              setAvailabilityOpen(true);
            }}
            data-testid="set-availability"
          >
            <Clock className="size-4" />
            {t.availability.menuItem}
          </Button>
          <LoadingButton
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleSignOut}
            loading={signingOut}
            data-testid="sign-out"
          >
            {!signingOut && <LogOut className="size-4" />}
            {t.auth.signOut}
          </LoadingButton>
        </PopoverContent>
      </Popover>

      <AvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
      />
    </>
  );
}
