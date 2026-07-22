"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number | React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded border border-gray-200 bg-white p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-gray-500">{title}</p>
          <p className={cn("mt-1 text-2xl font-bold truncate", valueClassName ?? "text-gray-900")}>
            {value}
          </p>
          {trend !== undefined && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 rounded-lg bg-blue-50 p-3 text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
