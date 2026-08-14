"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { categoryTint } from "@/components/categories/categoryMeta";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { CompletedSection } from "@/components/home/CompletedSection";
import { DeleteCategoryDialog } from "@/components/categories/DeleteCategoryDialog";
import { TaskBoard, TaskRows, useTaskBoard } from "@/components/tasks/TaskBoard";
import { useT } from "@/lib/i18n/locale-context";
import { sortByDateAndPriority } from "@/lib/tasks";
import type { Category, Task } from "@/lib/types";

type CategoryContentProps = {
  category: Category;
  tasks: Task[];
  categories: Category[];
  today: string;
};

export function CategoryContent(props: CategoryContentProps) {
  return (
    <TaskBoard
      categories={props.categories}
      today={props.today}
      initialTasks={props.tasks}
    >
      <CategoryView {...props} />
    </TaskBoard>
  );
}

function CategoryView({ category }: CategoryContentProps) {
  const t = useT();
  const board = useTaskBoard();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const visible = sortByDateAndPriority(
    board.tasks.filter((task) => task.category_id === category.id)
  );

  return (
    <div className="space-y-6" data-testid="category-page">
      <header
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
        style={{ backgroundImage: categoryTint(category.color) }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-on-strong"
            style={{ backgroundColor: category.color ?? "var(--primary)" }}
          >
            <CategoryIcon icon={category.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">
              {category.is_default ? t.categories.general : category.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {visible.length} · {t.categories.sortedBy}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!category.is_default && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.categories.editCategory}
                onClick={() => setRenameOpen(true)}
                data-testid="rename-category"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.categories.deleteCategory}
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                data-testid="delete-category"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
          <Button onClick={() => board.openNewTask(category.id)} data-testid="new-task">
            <Plus className="size-4" />
            {t.tasks.newTask}
          </Button>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {t.home.emptyList}
        </p>
      ) : (
        <div className="space-y-2">
          <TaskRows tasks={visible} />
        </div>
      )}

      <CompletedSection categoryId={category.id} />

      <CategoryFormDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        category={category}
      />
      <DeleteCategoryDialog
        category={category}
        hasTasks={visible.length > 0}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
