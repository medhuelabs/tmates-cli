import { apiRequest } from './http-client';

export type FileEntry = {
  name: string;
  relative_path: string;
  size: number;
  size_display: string;
  modified: string;
  modified_display: string;
  modified_iso?: string | null;
  download_url: string;
};

export type FileListing = {
  files: FileEntry[];
  total_count: number;
  total_size: number;
  total_size_display?: string | null;
  has_more: boolean;
  limit: number;
};

export async function fetchFiles(limit = 25): Promise<FileListing> {
  return apiRequest<FileListing>('/files', { query: { limit } });
}

export async function deleteFile(relativePath: string): Promise<{ success: boolean; message: string }>{
  return apiRequest<{ success: boolean; message: string }>(`/files/${encodeURIComponent(relativePath)}`, {
    method: 'DELETE',
  });
}
