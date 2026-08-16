import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Code2,
  Dumbbell,
  GraduationCap,
  Heart,
  Home,
  ListDetails,
  Palette,
  Plane,
  ShoppingCart,
  Target,
  Utensils,
  Wallet,
} from "@/components/icons";

/** Curated icon set a list can be tagged with (stored by key in the DB) */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  list: ListDetails,
  briefcase: Briefcase,
  book: BookOpen,
  graduation: GraduationCap,
  dumbbell: Dumbbell,
  heart: Heart,
  home: Home,
  cart: ShoppingCart,
  wallet: Wallet,
  utensils: Utensils,
  plane: Plane,
  palette: Palette,
  target: Target,
  code: Code2,
};

export function categoryIcon(icon: string | null | undefined): LucideIcon {
  return CATEGORY_ICONS[icon ?? "list"] ?? ListDetails;
}

/** Sober accent palette for lists (hex stored in the DB) */
export const CATEGORY_COLORS = [
  "#2C4A6E", // azul tinta
  "#A21CAF", // fucsia (reemplaza al teal que chocaba con la marca)
  "#3F6212", // oliva
  "#B45309", // bronce
  "#9F1239", // burdeos
  "#5B21B6", // violeta profundo
  "#0369A1", // azur
  "#475569", // pizarra
  "#7C2D12", // terracota
  "#1E3A8A", // azul marino
] as const;

export function categoryTint(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  return `linear-gradient(135deg, color-mix(in oklab, ${color} 10%, transparent), transparent 65%)`;
}
