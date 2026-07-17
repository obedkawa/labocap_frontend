"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  PaginationState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, RefreshCw, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/NativeSelect";

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  // Pagination côté serveur
  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Recherche globale
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  // Options
  isLoading?: boolean;
  rowClassName?: (row: T) => string;
  /** Titre affiché dans la barre d'outils du tableau (optionnel). */
  title?: string;
  /**
   * Callback du bouton « Actualiser ». Si absent, on invalide les requêtes
   * react-query actives (rechargement générique des données).
   */
  onRefresh?: () => void;
  /**
   * Masque le champ de recherche intégré à la barre d'outils. À utiliser quand
   * la page fournit sa propre recherche (ex. `SearchInput` dans le slot filtres),
   * pour éviter d'afficher deux champs de recherche.
   */
  hideToolbarSearch?: boolean;
  /**
   * Masque la barre d'outils du tableau (Actualiser · Réduire · Fermer). À utiliser
   * quand la page englobe déjà le tableau dans une carte qui fournit ces actions
   * (ex. `WidgetCard` de « Mon espace »), pour éviter des boutons en double.
   */
  hideToolbar?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  pageCount,
  pageIndex: controlledPageIndex,
  pageSize: controlledPageSize,
  onPageChange,
  onPageSizeChange,
  searchValue,
  onSearchChange,
  isLoading = false,
  rowClassName,
  title,
  onRefresh,
  hideToolbarSearch = false,
  hideToolbar = false,
}: DataTableProps<T>) {
  const isServerSide = pageCount !== undefined;
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [localSearch, setLocalSearch] = useState("");

  // Barre d'outils du tableau : réduire (masquer le corps) / fermer (masquer la carte).
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    if (onRefresh) {
      onRefresh();
    } else {
      queryClient.invalidateQueries();
    }
    // Petit retour visuel de rotation, sans bloquer.
    window.setTimeout(() => setRefreshing(false), 600);
  };

  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const pagination: PaginationState = isServerSide
    ? { pageIndex: controlledPageIndex ?? 0, pageSize: controlledPageSize ?? 10 }
    : localPagination;

  const table = useReactTable({
    data,
    columns,
    pageCount: isServerSide ? pageCount : undefined,
    state: {
      sorting,
      columnFilters,
      pagination,
      globalFilter: isServerSide ? undefined : (onSearchChange ? searchValue : localSearch),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: isServerSide
      ? (updater) => {
          const next =
            typeof updater === "function" ? updater(pagination) : updater;
          if (next.pageIndex !== pagination.pageIndex) {
            onPageChange?.(next.pageIndex);
          }
          if (next.pageSize !== pagination.pageSize) {
            onPageSizeChange?.(next.pageSize);
          }
        }
      : setLocalPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: isServerSide,
    manualFiltering: isServerSide && !!onSearchChange,
  });

  const currentPageIndex = table.getState().pagination.pageIndex;
  const currentPageSize = table.getState().pagination.pageSize;
  const totalPages = table.getPageCount();

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setLocalSearch(value);
      table.setGlobalFilter(value);
    }
  };

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (currentPageIndex > 2) pages.push("...");
      const start = Math.max(1, currentPageIndex - 1);
      const end = Math.min(totalPages - 2, currentPageIndex + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPageIndex < totalPages - 3) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  };

  // Bouton « Fermer » : la carte disparaît (revient au rechargement de la page).
  if (closed) return null;

  const toolBtn =
    "flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900";

  return (
    <div className="w-full space-y-3">
      {/* Barre de recherche */}
      {!hideToolbarSearch && (onSearchChange !== undefined || !isServerSide) && (
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            value={onSearchChange ? (searchValue ?? "") : localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Barre d'outils : Actualiser · Réduire · Fermer */}
        {!hideToolbar && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
          <span className="truncate text-sm font-semibold text-gray-700">
            {title ?? ""}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleRefresh}
              className={toolBtn}
              title="Actualiser"
              aria-label="Actualiser"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={toolBtn}
              title={collapsed ? "Agrandir" : "Réduire"}
              aria-label={collapsed ? "Agrandir" : "Réduire"}
            >
              {collapsed ? <Plus className="h-4 w-4" strokeWidth={2.25} /> : <Minus className="h-4 w-4" strokeWidth={2.25} />}
            </button>
            <button
              type="button"
              onClick={() => setClosed(true)}
              className={toolBtn}
              title="Fermer"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        )}

        {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300 bg-gray-200">
              <tr>
                {table.getHeaderGroups().flatMap((hg) =>
                  hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "border-r border-gray-300 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800 last:border-r-0",
                        header.column.getCanSort() && "cursor-pointer select-none"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-600">
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-4 w-4 text-blue-600" strokeWidth={3} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" strokeWidth={3} />
                            ) : (
                              <ChevronsUpDown className="h-4 w-4 text-gray-600" strokeWidth={2.5} />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: currentPageSize }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Aucune donnée disponible
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const custom = rowClassName?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "hover:bg-blue-50 transition-colors",
                        // `even:` l'emporterait sur la couleur fournie par la page
                        // (classe + pseudo-classe) : on ne raye que les lignes sans couleur propre.
                        !custom && "even:bg-gray-50",
                        custom
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border-r border-gray-300 px-4 py-3 text-gray-800 last:border-r-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Pagination — masquée quand le tableau est réduit */}
      {!collapsed && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Sélecteur de taille */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Lignes par page :</span>
          <NativeSelect
            value={currentPageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              if (isServerSide) {
                onPageSizeChange?.(size);
              } else {
                table.setPageSize(size);
              }
            }}
          >
            {[10, 20, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Numéros de pages */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {totalPages > 0 &&
            getPageNumbers().map((page, idx) =>
              page === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => table.setPageIndex(page as number)}
                  className={cn(
                    "flex h-8 min-w-[2rem] items-center justify-center rounded border px-2 text-sm transition-colors",
                    currentPageIndex === page
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {(page as number) + 1}
                </button>
              )
            )}

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Infos */}
        <p className="text-sm text-gray-600">
          Page {currentPageIndex + 1} sur {Math.max(totalPages, 1)}
        </p>
      </div>
      )}
    </div>
  );
}
