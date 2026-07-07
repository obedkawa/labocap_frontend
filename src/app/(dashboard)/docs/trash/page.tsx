"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import {
  docsApi,
  type Doc,
  formatFileSize,
} from "@/lib/api/docs";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Page : corbeille des documents (supprimés logiquement)
// ---------------------------------------------------------------------------

export default function DocsTrashPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [purgeConfirm, setPurgeConfirm] = useState<Doc | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["docs-trash", { page, size: pageSize }],
    queryFn: () => docsApi.trash({ page, size: pageSize }).then((r) => r.data),
  });

  const docs = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  const restoreMutation = useMutation({
    mutationFn: (id: string) => docsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs-trash"] });
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      toast.success("Document restauré");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la restauration");
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (id: string) => docsApi.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs-trash"] });
      toast.success("Document supprimé définitivement");
      setPurgeConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la suppression");
    },
  });

  const columns: ColumnDef<Doc>[] = [
    {
      header: "Titre",
      accessorKey: "title",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">{row.original.title}</span>
      ),
    },
    {
      header: "Taille",
      id: "fileSize",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{formatFileSize(row.original.fileSize)}</span>
      ),
    },
    {
      header: "Créé le",
      accessorKey: "createdAt",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center gap-1">
            <PermissionGate permission={PERMISSIONS.EDIT_DOCS}>
              <button
                type="button"
                onClick={() => restoreMutation.mutate(doc.id)}
                disabled={restoreMutation.isPending}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-green-600 transition-colors disabled:opacity-50"
                title="Restaurer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.DELETE_DOCS}>
              <button
                type="button"
                onClick={() => setPurgeConfirm(doc)}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                title="Supprimer définitivement"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corbeille"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Documents", href: "/docs" },
          { label: "Corbeille" },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={docs}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      <ConfirmModal
        isOpen={purgeConfirm !== null}
        onClose={() => setPurgeConfirm(null)}
        onConfirm={() => {
          if (purgeConfirm) purgeMutation.mutate(purgeConfirm.id);
        }}
        title="Supprimer définitivement"
        message={
          purgeConfirm
            ? `Voulez-vous supprimer définitivement "${purgeConfirm.title}" ? Le fichier et toutes ses versions seront perdus. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer définitivement"
        confirmVariant="danger"
        isLoading={purgeMutation.isPending}
      />
    </div>
  );
}
