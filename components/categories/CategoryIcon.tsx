import { createElement } from "react";
import { categoryIcon } from "@/components/categories/categoryMeta";

/** Renders a list's icon by its stored key */
export function CategoryIcon({
  icon,
  className,
  color,
}: {
  icon: string | null | undefined;
  className?: string;
  color?: string | null;
}) {
  return createElement(categoryIcon(icon), {
    className,
    style: color ? { color } : undefined,
  });
}
