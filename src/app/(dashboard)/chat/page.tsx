"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Plus, X } from "lucide-react";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { chatApi, ChatMessage, ChatUser } from "@/lib/api/chat";
import { useAuthStore } from "@/stores/auth.store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(firstname?: string, lastname?: string): string {
  if (!firstname && !lastname) return "?";
  return `${(firstname ?? "").charAt(0)}${(lastname ?? "").charAt(0)}`.toUpperCase();
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function truncate(str: string, len = 40): string {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function parseName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName?.split(" ") ?? [];
  return {
    firstname: parts[0] ?? "",
    lastname: parts.slice(1).join(" "),
  };
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ---------------------------------------------------------------------------
// Conversation sidebar item
// ---------------------------------------------------------------------------

interface ConversationItem {
  participantId: string;
  firstname: string;
  lastname: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
}

function buildConversations(
  messages: ChatMessage[],
  currentUserId: string
): ConversationItem[] {
  const map = new Map<string, ConversationItem>();

  for (const msg of messages) {
    const isMine = msg.senderId === currentUserId;
    const otherId = isMine ? msg.receiverId ?? "" : msg.senderId;
    if (!otherId) continue;

    const nameParts = (isMine ? msg.receiverName : msg.senderName)?.split(" ") ?? [];
    const firstname = nameParts[0] ?? "";
    const lastname = nameParts.slice(1).join(" ");

    const existing = map.get(otherId);

    if (!existing) {
      map.set(otherId, {
        participantId: otherId,
        firstname,
        lastname,
        lastMessage: msg.message,
        lastTime: msg.createdAt,
        unreadCount: !isMine && !msg.isRead ? 1 : 0,
      });
    } else {
      if (!isMine && !msg.isRead) {
        existing.unreadCount += 1;
      }
      if (msg.createdAt > existing.lastTime) {
        existing.lastMessage = msg.message;
        existing.lastTime = msg.createdAt;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.lastTime.localeCompare(a.lastTime)
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  return (
    <PermissionGate permission={PERMISSIONS.VIEW_CHAT}>
      <ChatContent />
    </PermissionGate>
  );
}

function ChatContent() {
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? "";

  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);

  // ---- Query : polling every 10 s ------------------------------------------

  const { data } = useQuery({
    queryKey: ["messages"],
    queryFn: () =>
      chatApi
        .findAll({ size: 200 })
        .then((r) => r.data),
    refetchInterval: 10000,
  });

  const allMessages: ChatMessage[] = data?.content ?? [];

  // ---- Query : liste des utilisateurs disponibles --------------------------

  const { data: usersData } = useQuery({
    queryKey: ["chat-users"],
    queryFn: () => chatApi.getUsers().then((r) => r.data),
    enabled: showNewConv,
  });

  const availableUsers: ChatUser[] = usersData ?? [];

  // ---- Derived state -------------------------------------------------------

  const conversations = buildConversations(allMessages, currentUserId);

  const selectedConv = conversations.find(
    (c) => c.participantId === selectedParticipantId
  );

  const threadMessages = allMessages
    .filter(
      (m) =>
        (m.senderId === currentUserId && m.receiverId === selectedParticipantId) ||
        (m.senderId === selectedParticipantId && m.receiverId === currentUserId)
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // ---- Auto scroll ---------------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length]);

  // ---- Sélection d'une conversation + marquer comme lu --------------------

  function handleSelectParticipant(participantId: string) {
    setSelectedParticipantId(participantId);
    setShowNewConv(false);
    chatApi
      .markAllAsRead(participantId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["messages"] }))
      .catch(() => {
        // silencieux — non bloquant
      });
  }

  // ---- Send mutation -------------------------------------------------------

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      chatApi.send({
        message: content,
        receiverId: selectedParticipantId ?? "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setNewMessage("");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Erreur lors de l'envoi";
      toast.error(msg);
    },
  });

  function handleSend() {
    const content = newMessage.trim();
    if (!content || !selectedParticipantId) return;
    sendMutation.mutate(content);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" />

      <div className="flex h-[calc(100vh-200px)] min-h-[500px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Left — conversation list */}
        <aside className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Conversations</p>
            <button
              onClick={() => setShowNewConv((v) => !v)}
              title="Nouvelle conversation"
              className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {showNewConv ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Panneau nouvelle conversation */}
          {showNewConv && (
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Démarrer avec :</p>
              {availableUsers.length === 0 ? (
                <p className="text-xs text-gray-400 py-2 text-center">Chargement…</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {availableUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => handleSelectParticipant(u.id)}
                        className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-gray-50 rounded transition-colors"
                      >
                        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-semibold text-white">
                          {getInitials(u.firstname, u.lastname)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {u.firstname} {u.lastname}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                Aucune conversation
              </p>
            ) : (
              <ul>
                {conversations.map((conv) => (
                  <li key={conv.participantId}>
                    <button
                      onClick={() => handleSelectParticipant(conv.participantId)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        selectedParticipantId === conv.participantId
                          ? "bg-blue-50"
                          : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
                        {getInitials(conv.firstname, conv.lastname)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {conv.firstname} {conv.lastname}
                          </span>
                          <span className="flex-shrink-0 text-xs text-gray-400 ml-1">
                            {formatTime(conv.lastTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-gray-500 truncate">
                            {truncate(conv.lastMessage)}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="ml-1 flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right — message thread */}
        <div className="flex flex-1 flex-col min-w-0">
          {selectedParticipantId === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Send className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm">
                Sélectionnez une conversation sur le côté gauche.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-gray-100 px-5 py-3 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">
                  {selectedConv
                    ? `${selectedConv.firstname} ${selectedConv.lastname}`
                    : "Conversation"}
                </h2>
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {threadMessages.map((msg) => {
                  const isMine = msg.senderId === currentUserId;
                  const senderParsed = parseName(msg.senderName);
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar */}
                      {!isMine && (
                        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-semibold text-white">
                          {getInitials(senderParsed.firstname, senderParsed.lastname)}
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`max-w-[70%] rounded-2xl px-3.5 py-2 ${
                          isMine
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-900 rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words">
                          {msg.message}
                        </p>
                        <p
                          className={`mt-0.5 text-[10px] ${
                            isMine ? "text-blue-100" : "text-gray-400"
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input zone */}
              <div className="border-t border-gray-100 px-5 py-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Envoyer un message"
                    className={inputClass}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sendMutation.isPending}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                    Envoyer
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
