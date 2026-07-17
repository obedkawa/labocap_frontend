"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { usersApi, User, UserRequest, Permission } from "@/lib/api/users";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  firstname: z.string().min(1, "Le prénom est requis"),
  lastname: z.string().min(1, "Le nom est requis"),
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
});

const editUserSchema = z.object({
  firstname: z.string().min(1, "Le prénom est requis"),
  lastname: z.string().min(1, "Le nom est requis"),
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  password: z.string().optional(),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
        Actif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
      Inactif
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Permissions directes
  const [directPermissionIds, setDirectPermissionIds] = useState<string[]>([]);
  const [directPermissionsLoading, setDirectPermissionsLoading] = useState(false);

  // Filtres
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");

  // ---- Queries & Mutations ------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    // size élevé : les filtres (recherche / statut / rôle) opèrent côté client
    // sur l'ensemble des utilisateurs, pas seulement la 1re page serveur.
    queryFn: () => usersApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => usersApi.getRoles().then((r) => r.data),
  });

  const { data: allPermissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => usersApi.getAllPermissions().then((r) => r.data),
  });

  const users: User[] = useMemo(() => data?.content ?? [], [data?.content]);
  const roles = rolesData?.content ?? [];
  const allPermissions: Permission[] = allPermissionsData ?? [];

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const permissionOptions = allPermissions.map((p) => ({
    value: p.id,
    label: p.name,
    slug: p.slug,
  }));

  const allRoleNames = useMemo(() => {
    const names = users.flatMap((u) => (u.roles ?? []).map((r) => r.name));
    return Array.from(new Set(names)).sort();
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const fullName = `${u.firstname} ${u.lastname}`.toLowerCase();
      const matchSearch =
        !search ||
        fullName.includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        !filterStatus ||
        (filterStatus === "active" ? u.isActive : !u.isActive);
      const matchRole =
        !filterRole || (u.roles ?? []).some((r) => r.name === filterRole);
      return matchSearch && matchStatus && matchRole;
    });
  }, [users, search, filterStatus, filterRole]);

  const createMutation = useMutation({
    mutationFn: (payload: UserRequest) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Utilisateur créé");
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
    mutationFn: ({ id, data }: { id: string; data: Partial<UserRequest> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Utilisateur modifié");
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
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Utilisateur supprimé");
      setDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) =>
      usersApi.setUserPermissions(id, ids),
    onSuccess: () => toast.success("Permissions directes sauvegardées"),
    onError: () => toast.error("Erreur lors de la sauvegarde des permissions"),
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstname: "",
      lastname: "",
      email: "",
      password: "",
      phone: "",
      roleIds: [],
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(user: User) {
    setSelectedUser(user);
    editForm.reset({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      password: "",
      phone: user.phone ?? "",
      roleIds: (user.roles ?? []).map((r) => r.id),
    });
    // Charger les permissions directes
    setDirectPermissionIds([]);
    setDirectPermissionsLoading(true);
    usersApi.getUserPermissions(user.id).then((r) => {
      setDirectPermissionIds((r.data ?? []).map((p) => p.id));
      setDirectPermissionsLoading(false);
    }).catch(() => {
      setDirectPermissionsLoading(false);
    });
    setEditOpen(true);
  }

  function openDelete(user: User) {
    setSelectedUser(user);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: CreateUserFormValues) {
    const payload: UserRequest = {
      firstname: values.firstname,
      lastname: values.lastname,
      email: values.email,
      password: values.password,
      phone: values.phone || undefined,
      roleIds: values.roleIds,
    };
    createMutation.mutate(payload);
  }

  function onEditSubmit(values: EditUserFormValues) {
    if (!selectedUser) return;
    const payload: Partial<UserRequest> = {
      firstname: values.firstname,
      lastname: values.lastname,
      email: values.email,
      phone: values.phone || undefined,
      roleIds: values.roleIds,
    };
    if (values.password && values.password.length > 0) {
      payload.password = values.password;
    }
    updateMutation.mutate({ id: selectedUser.id, data: payload });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<User>[] = [
    {
      header: "Nom & Prénom",
      id: "fullname",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {row.original.lastname} {row.original.firstname}
        </span>
      ),
    },
    {
      header: "Email",
      accessorKey: "email",
    },
    {
      header: "Téléphone",
      accessorKey: "phone",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      header: "Rôles",
      id: "roles",
      cell: ({ row }) => {
        const userRoles = row.original.roles ?? [];
        if (userRoles.length === 0) {
          return <span className="text-gray-400 text-xs">Aucun</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {userRoles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
              >
                {role.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      header: "Statut",
      id: "status",
      cell: ({ row }) => <StatusBadge isActive={row.original.isActive} />,
    },
    {
      header: "Date création",
      accessorKey: "createdAt",
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_USERS}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_USERS}>
            <button
              onClick={() => openDelete(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
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
        title="Utilisateurs"
        action={
          can(PERMISSIONS.CREATE_USERS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un utilisateur
            </button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <NativeSelect
          className="w-full max-w-[180px]"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </NativeSelect>
        <NativeSelect
          className="w-full max-w-[200px]"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">Tous les rôles</option>
          {allRoleNames.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un utilisateur"
        size="xl"
        contentClassName="min-h-[600px]"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un utilisateur"
        isSubmitting={createMutation.isPending}
      >
        <UserForm form={createForm} roleOptions={roleOptions} isCreate />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un utilisateur"
        size="xl"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <UserForm form={editForm} roleOptions={roleOptions} isCreate={false} />

        {/* Section permissions directes */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">
            Permissions directes
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Ces permissions s&apos;appliquent à cet utilisateur indépendamment de ses rôles.
          </p>
          {directPermissionsLoading ? (
            <div className="text-xs text-gray-400 py-2">Chargement...</div>
          ) : (
            <>
              <ReactSelect
                instanceId="user-direct-permissions"
                isMulti
                options={permissionOptions}
                value={permissionOptions.filter((o) =>
                  directPermissionIds.includes(o.value)
                )}
                onChange={(selected) =>
                  setDirectPermissionIds(selected.map((s) => s.value))
                }
                placeholder="Sélectionner des permissions directes..."
                noOptionsMessage={() => "Aucune permission disponible"}
                classNamePrefix="react-select"
                formatOptionLabel={(option: { value: string; label: string; slug: string }) => (
                  <span className="font-mono text-xs">{option.slug ?? option.label}</span>
                )}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: "#d1d5db",
                    borderRadius: "0.375rem",
                    minHeight: "38px",
                    boxShadow: "none",
                    "&:hover": { borderColor: "#d1d5db" },
                  }),
                  menu: (base) => ({ ...base, zIndex: 50 }),
                }}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savePermissionsMutation.isPending}
                  onClick={() => {
                    if (selectedUser) {
                      savePermissionsMutation.mutate({
                        id: selectedUser.id,
                        ids: directPermissionIds,
                      });
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savePermissionsMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {savePermissionsMutation.isPending ? "Sauvegarde..." : "Sauvegarder les permissions"}
                </button>
              </div>
            </>
          )}
        </div>
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={() => {
          if (selectedUser) deleteMutation.mutate(selectedUser.id);
        }}
        title="Supprimer cet utilisateur"
        message={`Voulez-vous vraiment supprimer l'utilisateur "${selectedUser?.firstname ?? ""} ${selectedUser?.lastname ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserForm — formulaire partagé création / édition
// ---------------------------------------------------------------------------

interface RoleOption {
  value: string;
  label: string;
}

interface UserFormProps {
  form: UseFormReturn<CreateUserFormValues> | UseFormReturn<EditUserFormValues>;
  roleOptions: RoleOption[];
  isCreate: boolean;
}

function UserForm({ form, roleOptions, isCreate }: UserFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form as UseFormReturn<CreateUserFormValues>;

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField label="Prénom" required error={errors.firstname?.message}>
        <input
          type="text"
          {...register("firstname")}
          placeholder="Prénom de l'utilisateur"
          className={inputClass}
        />
      </FormField>

      <FormField label="Nom" required error={errors.lastname?.message}>
        <input
          type="text"
          {...register("lastname")}
          placeholder="Nom de l'utilisateur"
          className={inputClass}
        />
      </FormField>

      <FormField label="Email" required error={errors.email?.message}>
        <input
          type="email"
          {...register("email")}
          placeholder="exemple@domaine.com"
          className={inputClass}
        />
      </FormField>

      <FormField
        label={isCreate ? "Mot de passe" : "Nouveau mot de passe"}
        required={isCreate}
        error={errors.password?.message}
        hint={isCreate ? undefined : "Laisser vide pour conserver l'actuel"}
      >
        <input
          type="password"
          {...register("password")}
          placeholder={isCreate ? "Minimum 8 caractères" : "Laisser vide pour ne pas changer"}
          className={inputClass}
        />
      </FormField>

      <FormField label="Téléphone" error={errors.phone?.message}>
        <input
          type="tel"
          {...register("phone")}
          placeholder="97000000"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Rôles"
        error={(errors as { roleIds?: { message?: string } }).roleIds?.message}
        className="sm:col-span-2"
      >
        <Controller
          name="roleIds"
          control={control}
          render={({ field }) => (
            <ReactSelect
              instanceId="user-roles"
              isMulti
              options={roleOptions}
              value={roleOptions.filter((o) =>
                (field.value ?? []).includes(o.value)
              )}
              onChange={(selected) =>
                field.onChange(selected.map((s) => s.value))
              }
              placeholder="Sélectionner des rôles..."
              noOptionsMessage={() => "Aucun rôle disponible"}
              classNamePrefix="react-select"
              styles={{
                control: (base) => ({
                  ...base,
                  borderColor: "#d1d5db",
                  borderRadius: "0.375rem",
                  minHeight: "38px",
                  boxShadow: "none",
                  "&:hover": { borderColor: "#d1d5db" },
                }),
                menu: (base) => ({ ...base, zIndex: 50 }),
              }}
            />
          )}
        />
      </FormField>
    </div>
  );
}
