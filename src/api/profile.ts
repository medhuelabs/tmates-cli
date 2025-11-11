import { apiRequest } from './http-client';

export type UserProfile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

export type UpdateUserProfileInput = {
  display_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
};

export async function fetchUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/profile');
}

export async function updateUserProfile(payload: UpdateUserProfileInput): Promise<UserProfile> {
  return apiRequest<UserProfile>('/profile', {
    method: 'PATCH',
    body: payload,
  });
}
