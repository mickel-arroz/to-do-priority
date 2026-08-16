"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categoryTint } from "@/components/categories/categoryMeta";
import { CategoryColorIcon } from "@/components/categories/CategoryColorIcon";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import type { SidebarCategory } from "@/components/layout/Sidebar";
import { useT } from "@/lib/i18n/locale-context";

/** Connector page: every list (General + custom) linking to its detail. */
export function ListsContent({ categories }: { categories: SidebarCategory[] }) {
  const t = useT();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6" data-testid="lists-page">
      <PageHeader
        title={t.nav.lists}
        actions={
          <Button onClick={() => setFormOpen(true)} data-testid="new-category">
            <Plus className="size-4" />
            {t.nav.newList}
          </Button>
        }
      />

      <div className="space-y-2">
        {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.id}`}
              data-testid={`list-link-${cat.id}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundImage: categoryTint(cat.color) }}
            >
              <CategoryColorIcon icon={cat.icon} color={cat.color} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {cat.is_default ? t.categories.general : cat.name}
              </span>
              <Badge variant="secondary">{cat.taskCount}</Badge>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
        ))}
      </div>

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
