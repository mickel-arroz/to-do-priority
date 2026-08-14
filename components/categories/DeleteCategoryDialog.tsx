"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import type { Category } from "@/lib/types";

type DeleteCategoryDialogProps = {
  category: Category;
  hasTasks: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteCategoryDialog({
  category,
  hasTasks,
  open,
  onOpenChange,
}: DeleteCategoryDialogProps) {
  const t = useT();
  const router = useRouter();
  const [deleting, setDeleting] = useState<"move" | "delete" | null>(null);

  async function handleDelete(strategy: "move" | "delete") {
    setDeleting(strategy);
    try {
      await api.categories.remove(category.id, strategy);
      onOpenChange(false);
      router.push("/");
      router.refresh();
    } catch {
      toast.error(t.common.error);
      setDeleting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="delete-category-dialog">
        <DialogHeader>
          <DialogTitle>
            {t.categories.deleteCategory}: {category.name}
          </DialogTitle>
          {hasTasks && (
            <DialogDescription>{t.categories.deleteQuestion}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {hasTasks ? (
            <>
              <LoadingButton
                onClick={() => handleDelete("move")}
                loading={deleting === "move"}
                disabled={deleting !== null}
                className="w-full"
                data-testid="delete-move"
              >
                {t.categories.moveToGeneral}
              </LoadingButton>
              <LoadingButton
                variant="destructive"
                onClick={() => handleDelete("delete")}
                loading={deleting === "delete"}
                disabled={deleting !== null}
                className="w-full"
                data-testid="delete-all"
              >
                {t.categories.deleteAll}
              </LoadingButton>
            </>
          ) : (
            <LoadingButton
              variant="destructive"
              onClick={() => handleDelete("delete")}
              loading={deleting === "delete"}
              className="w-full"
              data-testid="delete-all"
            >
              {t.common.delete}
            </LoadingButton>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {t.common.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
