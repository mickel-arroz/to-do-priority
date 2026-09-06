"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

/** Campo de contraseña con interruptor de visibilidad. */
export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("h-9 pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
