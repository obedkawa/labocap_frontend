"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "danger" | "secondary";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône affichée avant le libellé (dimensionner selon la taille : h-4 w-4 pour md, h-3.5 w-3.5 pour sm). */
  icon?: ReactNode;
  /** Affiche un spinner et désactive le bouton pendant une action asynchrone. */
  loading?: boolean;
}

// Thème Hyper : couleurs pleines + ombre portée teintée au survol (comme
// `.btn-primary:hover { box-shadow: 0 2px 6px 0 rgba(114,124,245,.5) }`).
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-600 hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]",
  danger:
    "bg-red-600 text-white hover:bg-red-600 hover:shadow-[0_2px_6px_0_rgba(250,92,124,0.5)]",
  secondary:
    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
};

// Bootstrap/Hyper exact : `.btn { padding:.45rem .9rem; font-size:.9rem;
// border-radius:.15rem }` et `.btn-sm { padding:.28rem .8rem; font-size:.875rem }`.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "gap-1 rounded-[.15rem] px-[.8rem] py-[.28rem] text-[.875rem]",
  md: "gap-2 rounded-[.15rem] px-[.9rem] py-[.45rem] text-[.9rem]",
};

const spinnerSize: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        // `.btn` : font-weight 400, line-height 1.5 (Bootstrap/Hyper).
        "inline-flex items-center justify-center font-normal leading-normal transition-[background-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className={cn(spinnerSize[size], "animate-spin")} /> : icon}
      {children}
    </button>
  );
}
