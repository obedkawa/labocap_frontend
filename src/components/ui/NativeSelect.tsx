"use client";

import type { SelectHTMLAttributes, Ref } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Applique le style d'erreur (bordure rouge). */
  error?: boolean;
  ref?: Ref<HTMLSelectElement>;
  /** Classe appliquée au conteneur (largeur, marges…). */
  className?: string;
  /** Classe appliquée au `<select>` lui-même (hauteur, arrondi, bordure…). */
  selectClassName?: string;
}

/**
 * `<select>` natif au design moderne : coins très arrondis, bordure douce,
 * anneau de focus « glow », flèche personnalisée. Compatible `register`.
 * Pour un select riche (recherche, multi, création) utiliser `SelectField`.
 */
export function NativeSelect({
  className,
  selectClassName,
  error,
  ref,
  children,
  ...props
}: NativeSelectProps) {
  return (
    <div className={cn("group relative", className)}>
      <select
        ref={ref}
        className={cn(
          "native-select w-full cursor-pointer rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-gray-700 shadow-sm outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
          error
            ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
            : "border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
          selectClassName
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors",
          !error && "group-focus-within:text-blue-500"
        )}
      />
    </div>
  );
}
