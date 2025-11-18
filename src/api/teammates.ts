import { apiRequest } from './http-client';

export type AgentManifestBranding = {
  avatar_url?: string;
  color?: string;
  accent_color?: string;
};

export type OrganizationAgentInfo = {
  id?: string;
  organization_id?: string;
  name?: string;
  description?: string;
  agent_type?: string;
  config?: Record<string, unknown> | null;
};

export type AgentMetadata = {
  key: string;
  name: string;
  description?: string;
  icon?: string | null;
  docs?: string | null;
  role?: string | null;
  category?: string | null;
  color?: string | null;
  capabilities?: string[] | null;
  tools?: unknown;
  detail_url?: string | null;
  settings_url?: string | null;
  branding?: AgentManifestBranding | null;
  hired?: boolean;
  organization_agent?: OrganizationAgentInfo | null;
  platform_available: boolean;
  user_enabled: boolean;
  can_use: boolean;
};

export type AgentsMetadataResponse = {
  platform_agents: string[];
  user_enabled_agents: string[];
  agents_metadata: Record<string, AgentMetadata>;
  access_summary: {
    can_use: string[];
    not_enabled: string[];
    not_installed: string[];
  };
};

export async function fetchAgentsMetadata(): Promise<AgentsMetadataResponse> {
  return apiRequest<AgentsMetadataResponse>('/agents/metadata');
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
