import { apiRequest } from './http-client';

export type ChatMessageAttachment = {
  uri: string;
  type?: string | null;
  name?: string | null;
  relative_path?: string | null;
  download_url?: string | null;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  author?: string | null;
  created_at?: string | null;
  payload: Record<string, unknown>;
  attachments: ChatMessageAttachment[];
};

export type ChatThreadSummary = {
  id: string;
  title: string;
  kind: string;
  agent_keys: string[];
  last_message_preview?: string | null;
  last_activity?: string | null;
  unread_count: number;
};

export type ChatThread = ChatThreadSummary & {
  messages: ChatMessage[];
};

export type ChatMessageCreate = {
  content: string;
  payload?: Record<string, unknown>;
  attachments?: ChatMessageAttachment[];
};

export async function fetchChatThreads(): Promise<ChatThreadSummary[]> {
  return apiRequest<ChatThreadSummary[]>('/chats');
}

export async function fetchChatThread(threadId: string): Promise<ChatThread> {
  return apiRequest<ChatThread>(`/chats/${encodeURIComponent(threadId)}`);
}

export async function createChatThread(agentKey: string): Promise<ChatThreadSummary> {
  return apiRequest<ChatThreadSummary>(`/chats?agent_key=${encodeURIComponent(agentKey)}`, {
    method: 'POST',
  });
}

export async function sendChatMessage(
  threadId: string,
  payload: ChatMessageCreate,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/chats/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    body: payload,
  });
}

export async function deleteChatThread(threadId: string): Promise<void> {
  await apiRequest<void>(`/chats/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
  });
}

export async function clearChatHistory(threadId: string): Promise<void> {
  await apiRequest<void>(`/chats/${encodeURIComponent(threadId)}/clear`, {
    method: 'POST',
  });
}
