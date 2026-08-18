"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormFieldset, useLockedOpenChange } from "@/components/ui/busy";
import { CharCounter } from "@/components/ui/char-counter";
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
  SELECTABLE_CATEGORY_ICONS,
} from "@/components/categories/categoryMeta";
import { api, ApiError } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useT } from "@/lib/i18n/locale-context";
import { LIMITS } from "@/lib/limits";
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
  // Default (General) list keeps the reserved `list` icon and can't change it
  const isDefaultList = category?.is_default ?? false;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("heart");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Derived-state-during-render: reset the fields each time the dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(category?.name ?? "");
      setIcon(category?.icon ?? "heart");
      setColor(category?.color ?? null);
    }
  }

  const nameOver = name.length > LIMITS.categoryName;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || nameOver) return;

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
          : apiErrorMessage(err, t)
      );
    } finally {
      setSaving(false);
    }
  }

  const handleOpenChange = useLockedOpenChange(saving, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>
            {category ? t.categories.editCategory : t.categories.newCategory}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormFieldset busy={saving} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="category-name">{t.categories.name}</Label>
              <CharCounter length={name.length} max={LIMITS.categoryName} />
            </div>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-invalid={nameOver}
              data-testid="category-name-input"
            />
          </div>

          {!isDefaultList && (
            <div className="space-y-2">
              <Label>{t.categories.icon}</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {Object.entries(SELECTABLE_CATEGORY_ICONS).map(([key, Icon]) => (
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
          )}

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
              disabled={!name.trim() || nameOver}
              data-testid="category-save"
            >
              {t.common.save}
            </LoadingButton>
          </DialogFooter>
          </FormFieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
