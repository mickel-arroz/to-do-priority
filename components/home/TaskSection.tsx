"use client";

import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDown } from "@/components/icons";
import { AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type TaskSectionProps = {
  id: string;
  title: React.ReactNode;
  /** Rendered next to the title, outside the trigger text (e.g. progress bar) */
  aside?: React.ReactNode;
  count: number;
  emptyMessage: string;
  /** Optional list accent color: tints the section background */
  accentColor?: string | null;
  /** Rendered after the rows (even when count is 0), e.g. today's completed */
  footer?: React.ReactNode;
  /** Whether the accordion starts expanded (default true) */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Every task section is an accordion, expanded by default. Header is one
 * aligned row: chevron (left of the title) · title · counter · aside.
 */
export function TaskSection({
  id,
  title,
  aside,
  count,
  emptyMessage,
  accentColor,
  footer,
  defaultOpen = true,
  children,
  className,
}: TaskSectionProps) {
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? id : undefined}
      className={cn("w-full", className)}
      style={
        accentColor
          ? {
              // Opaque accent tint (composited over the card color) so the
              // page background/grid never shows through the section
              backgroundColor: `color-mix(in oklab, ${accentColor} 8%, var(--card))`,
              borderRadius: "var(--radius)",
            }
          : undefined
      }
    >
      <AccordionItem
        value={id}
        className={cn("border-none", accentColor && "px-3")}
      >
        <div className="flex items-center gap-3">
          <AccordionPrimitive.Header className="flex min-w-0">
            <AccordionPrimitive.Trigger
              className="group flex items-center gap-2 py-3 text-left font-heading text-lg font-bold outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
              data-testid={`section-${id}`}
            >
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <span className="flex min-w-0 items-center gap-2 truncate">
                {title}
              </span>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {count}
              </span>
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          {aside && <div className="min-w-0 flex-1">{aside}</div>}
        </div>
        <AccordionContent className="pb-2">
          {count === 0 ? (
            <EmptyState>{emptyMessage}</EmptyState>
          ) : (
            <div className="space-y-2">{children}</div>
          )}
          {footer && <div className="mt-2 space-y-2">{footer}</div>}
        </AccordionContent>
      </AccordionItem>
    </AccordionPrimitive.Root>
  );
}
