import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { cn } from "@/lib/utils";

/**
 * Solid colored square showing a list's icon (its color as background,
 * white-ish ink). Shared by the lists index and the category header.
 */
export function CategoryColorIcon({
  icon,
  color,
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md text-on-strong",
        className
      )}
      style={{ backgroundColor: color ?? "var(--primary)" }}
    >
      <CategoryIcon icon={icon} className="size-5" />
    </span>
  );
}
