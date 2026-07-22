"use client";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary"
  | "secondary";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

// Badges « lighten » du thème Hyper : teinte du statut à 18 % d'opacité,
// texte à la couleur pleine (ex. `.badge-success-lighten`).
const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-[rgba(10,207,151,0.18)] text-[#0acf97]",
  warning: "bg-[rgba(255,188,0,0.18)] text-[#ffbc00]",
  danger: "bg-[rgba(250,92,124,0.18)] text-[#fa5c7c]",
  info: "bg-[rgba(57,175,209,0.18)] text-[#39afd1]",
  primary: "bg-blue-600 text-white",
  secondary: "bg-[rgba(49,58,70,0.18)] text-[#313a46]",
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded px-[.4em] py-[.25em] text-[.75em] font-bold",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
