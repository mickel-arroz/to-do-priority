"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
} from "@/components/categories/categoryMeta";
import { api, ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits instead of creating */
  category?: Category | null;
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: CategoryFormDialogProps) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("list");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Derived-state-during-render: reset the fields each time the dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(category?.name ?? "");
      setIcon(category?.icon ?? "list");
      setColor(category?.color ?? null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const input = { name: trimmed, icon, color };
      if (category) await api.categories.update(category.id, input);
      else await api.categories.create(input);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 409
          ? t.categories.nameTaken
          : t.common.error
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {category ? t.categories.editCategory : t.categories.newCategory}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">{t.categories.name}</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid="category-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.categories.icon}</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={icon === key}
                  onClick={() => setIcon(key)}
                  data-testid={`icon-${key}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border transition-colors",
                    icon === key
                      ? "border-primary bg-accent text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.categories.color}</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={color === c}
                  onClick={() => setColor(color === c ? null : c)}
                  data-testid={`color-${c.slice(1)}`}
                  className="flex size-7 items-center justify-center rounded-md border border-foreground/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="size-4 text-on-strong" />}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <LoadingButton
              type="submit"
              loading={saving}
              disabled={!name.trim()}
              data-testid="category-save"
            >
              {t.common.save}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
