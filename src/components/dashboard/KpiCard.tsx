"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
}

export function KpiCard({ title, value, trend, subtitle, icon, iconBg }: KpiCardProps) {
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div className="rounded border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-500">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>

          {trend !== undefined && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {trend}%
              </span>
            </div>
          )}

          {subtitle && (
            <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex-shrink-0 rounded-lg p-3",
              iconBg ?? "bg-blue-50 text-blue-600"
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
