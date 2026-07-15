"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, Send } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { useAuthStore } from "@/stores/auth.store";
import {
  supportApi,
  type Ticket,
  type TicketRequest,
  type TicketStatus,
  type TicketPriority,
  type TicketComment,
} from "@/lib/api/support";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50";

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  HIGH: "Haute",
  MEDIUM: "Moyenne",
  LOW: "Basse",
  CRITICAL: "Critique",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

function priorityBadge(priority: TicketPriority) {
  if (priority === "HIGH" || priority === "CRITICAL")
    return <Badge variant="danger">{PRIORITY_LABEL[priority] ?? priority}</Badge>;
  if (priority === "MEDIUM")
    return <Badge variant="warning">{PRIORITY_LABEL[priority] ?? priority}</Badge>;
  return <Badge variant="secondary">{PRIORITY_LABEL[priority] ?? priority}</Badge>;
}

function statusBadge(status: TicketStatus) {
  if (status === "OPEN") return <Badge variant="info">{STATUS_LABEL[status]}</Badge>;
  if (status === "IN_PROGRESS")
    return <Badge variant="warning">{STATUS_LABEL[status]}</Badge>;
  if (status === "RESOLVED")
    return <Badge variant="success">{STATUS_LABEL[status]}</Badge>;
  return <Badge variant="secondary">{STATUS_LABEL[status]}</Badge>;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Messages panel (inside modal)
// ---------------------------------------------------------------------------

interface MessagesPanelProps {
  ticket: Ticket;
  currentUserId: string;
}

function MessagesPanel({ ticket, currentUserId }: MessagesPanelProps) {
  const [messageInput, setMessageInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    data: messages,
    refetch: refetchMessages,
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ["ticket-comments", ticket.id],
    queryFn: () => supportApi.getComments(ticket.id).then((r) => r.data),
    refetchInterval: 10000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      supportApi.addComment(ticket.id, { content }),
    onSuccess: () => {
      setMessageInput("");
      refetchMessages();
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Erreur lors de l'envoi";
      toast.error(msg);
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    sendMessageMutation.mutate(trimmed);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* En-tête ticket */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <span className="font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {ticket.title}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusBadge(ticket.status)}
          {priorityBadge(ticket.priority)}
        </div>
      </div>

      {/* Fil de messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 min-h-[240px] max-h-[380px]">
        {isLoadingMessages ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Chargement des messages…
          </p>
        ) : !messages || messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Aucun message pour ce ticket.
          </p>
        ) : (
          messages.map((msg: TicketComment) => {
            const isMe = msg.userId === currentUserId;
            const senderName = msg.userName ?? "Inconnu";
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
              >
                <span className="text-xs text-gray-400 px-1">{senderName}</span>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <span className="text-[11px] text-gray-400 px-1">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone d'envoi */}
      {ticket.status !== "CLOSED" && (
        <form
          onSubmit={handleSend}
          className="mt-3 flex items-end gap-2 pt-3 border-t border-gray-200"
        >
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as unknown as React.FormEvent);
              }
            }}
            rows={2}
            placeholder="Écrire un message… (Entrée pour envoyer)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <button
            type="submit"
            disabled={sendMessageMutation.isPending || !messageInput.trim()}
            className="flex-shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {ticket.status === "CLOSED" && (
        <p className="mt-3 text-xs text-gray-400 text-center pt-3 border-t border-gray-200">
          Ce ticket est clôturé — les réponses sont désactivées.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ticketSchema = z.object({
  title: z.string().min(1, { message: "Le titre est requis" }),
  description: z
    .string()
    .min(10, { message: "La description doit contenir au moins 10 caractères" }),
  priority: z.string().optional(),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

// ---------------------------------------------------------------------------
// Detail panel (inline)
// ---------------------------------------------------------------------------

function TicketDetail({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900">{ticket.title}</h3>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
        {ticket.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
        <span>
          Priorité : {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
        </span>
        <span>·</span>
        <span>Statut : {STATUS_LABEL[ticket.status]}</span>
        <span>·</span>
        <span>Créé le {formatDate(ticket.createdAt)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageInner />
    </Suspense>
  );
}

function SupportPageInner() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  // Le sous-menu « Signaler » (sidebar) pointe vers /support?new=1 : on ouvre
  // alors directement le formulaire de création de ticket (état initial dérivé de l'URL).
  const [createOpen, setCreateOpen] = useState(
    () => searchParams.get("new") === "1"
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [messagesTicketId, setMessagesTicketId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ---- Query ---------------------------------------------------------------

  const params: Record<string, unknown> = { page, size: pageSize };
  if (statusFilter) params.status = statusFilter;
  if (priorityFilter) params.priority = priorityFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", params],
    queryFn: () => supportApi.getTickets(params).then((r) => r.data),
  });

  const tickets: Ticket[] = data?.content ?? [];

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: TicketRequest) => supportApi.createTicket(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket créé");
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

  const closeMutation = useMutation({
    mutationFn: (id: string) => supportApi.closeTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket clôturé");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // Transitions de statut intermédiaires (En cours / Résolu) — réplique le
  // workflow complet des tickets (supportApi.updateStatus).
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      supportApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Statut mis à jour");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Form ----------------------------------------------------------------

  const createForm = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: "", description: "", priority: "" },
  });

  function onCreateSubmit(values: TicketFormValues) {
    createMutation.mutate({
      title: values.title,
      description: values.description,
      priority: (values.priority as TicketPriority) || undefined,
    });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Ticket>[] = [
    {
      header: "Titre",
      accessorKey: "title",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">{row.original.title}</span>
      ),
    },
    {
      header: "Priorité",
      accessorKey: "priority",
      cell: ({ row }) => priorityBadge(row.original.priority),
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      header: "Créé par",
      id: "createdBy",
      cell: ({ row }) => row.original.userName ?? "—",
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const ticket = row.original;
        const isDetail = detailId === ticket.id;
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setMessagesTicketId(ticket.id)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Messages
            </button>
            <button
              onClick={() =>
                setDetailId(isDetail ? null : ticket.id)
              }
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {isDetail ? "Masquer" : "Voir"}
            </button>

            {ticket.status !== "CLOSED" && (
              <PermissionGate permission={PERMISSIONS.MANAGE_SUPPORT}>
                {ticket.status === "OPEN" && (
                  <button
                    onClick={() =>
                      statusMutation.mutate({
                        id: ticket.id,
                        status: "IN_PROGRESS",
                      })
                    }
                    disabled={statusMutation.isPending}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    Prendre en charge
                  </button>
                )}
                {ticket.status === "IN_PROGRESS" && (
                  <button
                    onClick={() =>
                      statusMutation.mutate({
                        id: ticket.id,
                        status: "RESOLVED",
                      })
                    }
                    disabled={statusMutation.isPending}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    Résoudre
                  </button>
                )}
                <button
                  onClick={() => closeMutation.mutate(ticket.id)}
                  disabled={closeMutation.isPending}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Fermer
                </button>
              </PermissionGate>
            )}
          </div>
        );
      },
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signaler un problème"
        action={
          <button
            onClick={() => {
              createForm.reset();
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Nouveau ticket
          </button>
        }
      />

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 gap-3">
          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="OPEN">Ouvert</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="RESOLVED">Résolu</option>
            <option value="CLOSED">Clôturé</option>
          </NativeSelect>

          <NativeSelect
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Toutes les priorités</option>
            <option value="CRITICAL">Critique</option>
            <option value="HIGH">Haute</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="LOW">Basse</option>
          </NativeSelect>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
        <DataTable
          columns={columns}
          data={tickets}
          isLoading={isLoading}
          pageCount={data?.totalPages ?? 0}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(0);
          }}
        />
        {/* Detail panel below table */}
        {detailId && (
          <div className="mt-2">
            {(() => {
              const found = tickets.find((t) => t.id === detailId);
              if (!found) return null;
              return (
                <TicketDetail
                  ticket={found}
                  onClose={() => setDetailId(null)}
                />
              );
            })()}
          </div>
        )}
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouveau ticket"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Créer"
        isSubmitting={createMutation.isPending}
      >
        <TicketForm form={createForm} />
      </CrudModal>

      {/* Modal messages */}
      {messagesTicketId && (() => {
        const selectedTicket = tickets.find((t) => t.id === messagesTicketId);
        if (!selectedTicket) return null;
        return (
          <CrudModal
            isOpen={!!messagesTicketId}
            onClose={() => setMessagesTicketId(null)}
            title="Messages du ticket"
            size="xl"
            footer={<></>}
          >
            <MessagesPanel
              ticket={selectedTicket}
              currentUserId={user?.id ?? ""}
            />
          </CrudModal>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TicketForm
// ---------------------------------------------------------------------------

interface TicketFormProps {
  form: UseFormReturn<TicketFormValues>;
}

function TicketForm({ form }: TicketFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <FormField label="Titre" required error={errors.title?.message}>
        <input
          type="text"
          {...register("title")}
          placeholder="Objet du ticket"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Description"
        required
        error={errors.description?.message}
      >
        <textarea
          {...register("description")}
          rows={4}
          placeholder="Décrivez le problème en détail (10 caractères min.)"
          className={inputClass}
        />
      </FormField>

      <RHFSelect
        control={control}
        name="priority"
        label="Priorité"
        options={[
          { value: "LOW", label: "Basse" },
          { value: "MEDIUM", label: "Moyenne" },
          { value: "HIGH", label: "Haute" },
          { value: "CRITICAL", label: "Critique" },
        ]}
        placeholder="Sélectionner une priorité"
        error={errors.priority?.message}
        isClearable
      />
    </div>
  );
}
