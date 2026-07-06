"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconButtonVariant = "default" | "edit" | "delete";

const variantClasses: Record<IconButtonVariant, string> = {
  default: "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  edit: "text-gray-500 hover:bg-gray-100 hover:text-blue-600",
  delete: "text-gray-500 hover:bg-gray-100 hover:text-red-600",
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: IconButtonVariant;
}

/** Petit bouton carré ne contenant qu'une icône (style « ghost »). */
export function IconButton({
  icon,
  variant = "default",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
