"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { usersApi, Permission } from "@/lib/api/users";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Extrait l'opération depuis le slug : "view-patients" → "view"
function extractOperation(slug: string): string {
  const ops = ["manage", "create", "delete", "edit", "view"];
  for (const op of ops) {
    if (slug.startsWith(op + "-") || slug === op) return op;
  }
  return slug.split("-")[0];
}

// Extrait la ressource depuis le slug : "view-patients" → "patients"
function extractResource(slug: string): string {
  const op = extractOperation(slug);
  return slug.startsWith(op + "-") ? slug.slice(op.length + 1) : slug;
}

// Badge couleur selon l'opération
function OperationBadge({ operation }: { operation: string }) {
  const colors: Record<string, string> = {
    view:   "bg-gray-100 text-gray-700",
    create: "bg-green-100 text-green-700",
    edit:   "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    manage: "bg-purple-100 text-purple-700",
  };
  const cls = colors[operation] ?? "bg-yellow-100 text-yellow-700";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {operation}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PermissionsPage() {
  const [search, setSearch] = useState("");

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => usersApi.getAllPermissions().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    if (!search) return permissions;
    const q = search.toLowerCase();
    return (permissions as Permission[]).filter(
      (p) => p.slug.includes(q) || p.name.toLowerCase().includes(q)
    );
  }, [permissions, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of filtered as Permission[]) {
      const resource = extractResource(p.slug);
      if (!map.has(resource)) map.set(resource, []);
      map.get(resource)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader title="Permissions" />

      {/* Barre de recherche + compteur */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une permission..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} permission{filtered.length !== 1 ? "s" : ""} &middot;{" "}
          {groups.length} groupe{groups.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grille de groupes */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Chargement...</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Aucune permission trouvée</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(([resource, perms]) => (
            <div
              key={resource}
              className="rounded-xl border border-gray-200 bg-white shadow-sm p-4"
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <Shield className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  {resource.replace(/_/g, " ")}
                </h3>
                <span className="ml-auto text-xs text-gray-400">{perms.length}</span>
              </div>
              <ul className="space-y-1.5">
                {perms.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <OperationBadge operation={extractOperation(p.slug)} />
                    <span
                      className="text-xs text-gray-600 font-mono truncate"
                      title={p.slug}
                    >
                      {p.slug}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
