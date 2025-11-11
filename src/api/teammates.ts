import { apiRequest } from './http-client';

export type Teammate = {
  key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  detail_url?: string | null;
  settings_url?: string | null;
};

export type AgentStoreEntry = {
  key: string;
  name: string;
  description: string;
  icon?: string | null;
  hired: boolean;
  metadata?: {
    manifest?: {
      branding?: {
        avatar_url?: string;
        color?: string;
        accent_color?: string;
      };
    };
  };
};

export type AgentStoreResponse = {
  available_agents: AgentStoreEntry[];
};

export async function fetchTeammates(): Promise<Teammate[]> {
  return apiRequest<Teammate[]>('/teammates');
}

export async function fetchAgentStore(): Promise<AgentStoreResponse> {
  return apiRequest<AgentStoreResponse>('/agents/store');
}

export async function manageAgent(agentKey: string, action: 'add' | 'remove'): Promise<{ success: boolean; message: string }>{
  return apiRequest<{ success: boolean; message: string }>('/agents/manage', {
    method: 'POST',
    body: {
      agent_key: agentKey,
      action,
    },
  });
}
