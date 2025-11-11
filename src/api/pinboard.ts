import { apiRequest } from './http-client';

export type PinboardAttachment = {
  url: string;
  label?: string | null;
  type?: string | null;
};

export type PinboardSource = {
  url: string;
  label?: string | null;
};

export type PinboardPriority = 'low' | 'normal' | 'high' | 'urgent' | number;

export type PinboardPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content_md?: string | null;
  author_agent_key?: string | null;
  author_display?: string | null;
  cover_url?: string | null;
  priority: PinboardPriority;
  created_at?: string | null;
  updated_at?: string | null;
  attachments: PinboardAttachment[];
  sources: PinboardSource[];
};

export async function fetchPinboardPosts(limit = 10): Promise<PinboardPost[]> {
  return apiRequest<PinboardPost[]>('/pinboard', { query: { limit } });
}

export async function fetchPinboardPost(slug: string): Promise<PinboardPost> {
  return apiRequest<PinboardPost>(`/pinboard/${encodeURIComponent(slug)}`);
}
