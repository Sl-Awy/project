import { apiRequest, type ApiResponse } from "./client";

export interface Conversation {
  id: number;
  name: string | null;
  avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
}

export interface MessageRow {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  created_at: string;
}

export function getConversations(): Promise<ApiResponse<Conversation[]>> {
  return apiRequest("/api/messenger/conversations");
}

export function getMessages(peerId: number): Promise<ApiResponse<MessageRow[]>> {
  const params = new URLSearchParams({ user_id: String(peerId) });
  return apiRequest(`/api/messenger/messages?${params}`);
}

export function sendMessage(userId: number, body: string): Promise<ApiResponse<MessageRow>> {
  return apiRequest<MessageRow>("/api/messenger/messages", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, body }),
  });
}
