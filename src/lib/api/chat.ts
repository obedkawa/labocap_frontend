import apiClient from "./client";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  message: string;
  isRead: boolean;
  branchId?: string;
  createdAt: string;
}

export interface ChatRequest {
  receiverId: string;
  message: string;
}

export interface ChatUser {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
}

export const chatApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<{ content: ChatMessage[]; totalElements: number; totalPages: number }>(
      "/chats",
      { params }
    ),

  findConversation: (receiverId: string, params?: { page?: number; size?: number }) =>
    apiClient.get<{ content: ChatMessage[]; totalElements: number; totalPages: number }>(
      "/chats",
      { params: { receiverId, ...params } }
    ),

  send: (data: ChatRequest) =>
    apiClient.post<ChatMessage>("/chats", data),

  markAsRead: (id: string) =>
    apiClient.patch<ChatMessage>(`/chats/${id}/read`),

  markAllAsRead: (senderId: string) =>
    apiClient.patch<{ count: number }>("/chats/read-all", null, { params: { senderId } }),

  getUsers: () =>
    apiClient.get<ChatUser[]>("/chats/users"),
};
