import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Broom,
  Code2,
  Dumbbell,
  GoalReplace,
  GraduationCap,
  Heart,
  Home,
  Languages,
  ListDetails,
  Palette,
  Plane,
  ShoppingCart,
  Sprout,
  Utensils,
  Wallet,
} from "@/components/icons";

/**
 * Curated icon set a list can be tagged with (stored by key in the DB).
 * `list` is reserved for the default "General" list and is NOT offered in the
 * picker (see SELECTABLE_CATEGORY_ICONS); it stays here for resolution/fallback.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  list: ListDetails,
  heart: Heart, // salud
  dumbbell: Dumbbell, // deporte
  graduation: GraduationCap, // universidad
  code: Code2, // programación
  briefcase: Briefcase, // trabajo
  book: BookOpen, // estudios
  sprout: Sprout, // jardinería / naturaleza
  languages: Languages, // idiomas
  palette: Palette, // arte
  utensils: Utensils, // cocina
  plane: Plane, // viajes
  wallet: Wallet, // finanzas
  cart: ShoppingCart, // compras
  cleaning: Broom, // limpieza / aseo
  home: Home, // hogar (solo resolución, no seleccionable)
  target: GoalReplace, // metas (reservado para la página de hábitos)
};

/**
 * Icons reserved for other purposes, kept only for resolution/fallback:
 * `list` is the default "General" list, `target` is the Habits page icon, and
 * `home` was retired from the picker in favor of `cleaning`.
 */
const RESERVED_ICONS = new Set(["list", "target", "home"]);

/** Icons offered in the category picker (everything except the reserved ones) */
export const SELECTABLE_CATEGORY_ICONS: Record<string, LucideIcon> =
  Object.fromEntries(
    Object.entries(CATEGORY_ICONS).filter(([key]) => !RESERVED_ICONS.has(key))
  );

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
