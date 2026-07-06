"use client";

import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Applique le style d'erreur (bordure rouge). */
  error?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Champ de saisie natif stylé, compatible avec `register` de react-hook-form
 * (le `ref` renvoyé par register est transmis en prop — React 19).
 */
export function TextInput({ className, error, ref, ...props }: TextInputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1",
        error
          ? "border-red-300 focus:border-red-500 focus:ring-red-500"
          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
        className
      )}
      {...props}
    />
  );
}
