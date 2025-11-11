import chalk from 'chalk';
import { resolveAppConfig } from '../config/app-config';
import { getAccessToken } from '../auth/supabase-auth';

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type RequestOptions = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string | null;
  allowUnauthenticated?: boolean;
};

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = await resolveAppConfig();
  const base = config.apiBaseUrl;
  if (!base) {
    throw new Error(
      'API base URL is not configured. Set TMATES_API_BASE_URL or configure it via CLI settings.',
    );
  }

  const url = buildUrl(base, path, options.query);
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined && options.body !== null) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (typeof options.body === 'string' || options.body instanceof URLSearchParams) {
      body = options.body;
    } else {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
  }

  const token = options.token ?? getAccessToken();
  if (!options.allowUnauthenticated && !token) {
    throw new Error('You must be signed in to perform this action. Run `tmates login`.');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  const rawText = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson && rawText ? JSON.parse(rawText) : rawText;

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText || 'Request failed') || 'Request failed';
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

function buildUrl(base: string, path: string, query?: RequestOptions['query']): string {
  const trimmedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${trimmedBase}${normalizedPath}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail;
    if (detail && typeof detail === 'object') {
      return `${chalk.red(`[${error.status}] ${error.message}`)}\n${JSON.stringify(detail, null, 2)}`;
    }
    return chalk.red(`[${error.status}] ${error.message}`);
  }
  if (error instanceof Error) {
    return chalk.red(error.message);
  }
  return chalk.red(String(error));
}
