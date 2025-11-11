import { apiRequest } from './http-client';

export type MobileSettings = {
  allow_notifications: boolean;
  mentions: boolean;
  direct_messages: boolean;
  team_messages: boolean;
  usage_analytics: boolean;
  crash_reports: boolean;
  theme_preference: 'system' | 'light' | 'dark';
};

export type UpdateMobileSettingsInput = Partial<MobileSettings>;

export async function fetchMobileSettings(): Promise<MobileSettings> {
  return apiRequest<MobileSettings>('/settings/mobile');
}

export async function updateMobileSettings(payload: UpdateMobileSettingsInput): Promise<MobileSettings> {
  return apiRequest<MobileSettings>('/settings/mobile', {
    method: 'PATCH',
    body: payload,
  });
}
