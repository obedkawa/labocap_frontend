"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { clientsApi, Client, ClientRequest } from "@/lib/api/clients";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  address: z.string().optional(),
  contact: z.string().optional(),
  ifu: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Input style helper
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClientsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // ---- Queries & Mutations ------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsApi.findAll().then((r) => r.data),
  });

  const clients: Client[] = data?.content ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: ClientRequest) => clientsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client créé");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientRequest }) =>
      clientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client modifié");
      setEditOpen(false);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client supprimé");
      setDeleteOpen(false);
      setSelectedClient(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      address: "",
      contact: "",
      ifu: "",
    },
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(client: Client) {
    setSelectedClient(client);
    editForm.reset({
      name: client.name,
      address: client.address ?? "",
      contact: client.contact ?? "",
      ifu: client.ifu ?? "",
    });
    setEditOpen(true);
  }

  function openDelete(client: Client) {
    setSelectedClient(client);
    setDeleteOpen(true);
  }

  function buildPayload(values: ClientFormValues): ClientRequest {
    return {
      name: values.name,
      address: values.address || undefined,
      contact: values.contact || undefined,
      ifu: values.ifu || undefined,
    };
  }

  function onCreateSubmit(values: ClientFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: ClientFormValues) {
    if (!selectedClient) return;
    updateMutation.mutate({ id: selectedClient.id, data: buildPayload(values) });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Client>[] = [
    {
      header: "#",
      id: "index",
      cell: ({ row }) => row.index + 1,
    },
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Téléphone",
      accessorKey: "contact",
      cell: ({ row }) => row.original.contact ?? "—",
    },
    {
      header: "Adresse",
      accessorKey: "address",
      cell: ({ row }) => row.original.address ?? "—",
    },
    {
      header: "Numéro IFU",
      accessorKey: "ifu",
      cell: ({ row }) => row.original.ifu ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_CLIENTS}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_CLIENTS}>
            <button
              onClick={() => openDelete(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients Professionnels"
        action={
          can(PERMISSIONS.CREATE_CLIENTS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un client professionnel
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={clients} isLoading={isLoading} />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un client professionnel"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un client professionnel"
        isSubmitting={createMutation.isPending}
      >
        <ClientForm form={createForm} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un client professionnel"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <ClientForm form={editForm} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedClient(null);
        }}
        onConfirm={() => {
          if (selectedClient) deleteMutation.mutate(selectedClient.id);
        }}
        title="Supprimer ce client"
        message={`Voulez-vous vraiment supprimer le client "${selectedClient?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClientForm — formulaire partagé création / édition
// ---------------------------------------------------------------------------

interface ClientFormProps {
  form: UseFormReturn<ClientFormValues>;
}

function ClientForm({ form }: ClientFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Nom" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Nom du client"
          className={inputClass}
        />
      </FormField>

      <FormField label="Adresse" error={errors.address?.message}>
        <input
          type="text"
          {...register("address")}
          placeholder="Adresse du client"
          className={inputClass}
        />
      </FormField>

      <FormField label="Contact" error={errors.contact?.message}>
        <input
          type="tel"
          {...register("contact")}
          placeholder="97000000"
          className={inputClass}
        />
      </FormField>

      <FormField label="Numéro IFU" error={errors.ifu?.message}>
        <input
          type="text"
          {...register("ifu")}
          placeholder="Numéro IFU"
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
