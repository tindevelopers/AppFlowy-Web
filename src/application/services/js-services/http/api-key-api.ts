import { APIResponse, executeAPIRequest, executeAPIVoidRequest, getAxios } from './core';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  workspace_id: string | null;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreateApiKeyPayload {
  name: string;
  workspace_id?: string | null;
  expires_at?: string | null;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  /** Plaintext key. Returned by the server exactly once, at creation. */
  key: string;
  key_prefix: string;
  workspace_id: string | null;
  created_at: string;
  expires_at: string | null;
}

/**
 * List all API keys for the authenticated user.
 * Requires a session JWT (not an API key).
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  const url = '/api/api-key';

  return executeAPIRequest<ApiKey[]>(() =>
    getAxios()?.get<APIResponse<ApiKey[]>>(url)
  );
}

/**
 * Create a new API key. The plaintext key is returned only here, once.
 * Requires a session JWT (not an API key).
 */
export async function createApiKey(payload: CreateApiKeyPayload): Promise<CreateApiKeyResponse> {
  const url = '/api/api-key';

  return executeAPIRequest<CreateApiKeyResponse>(() =>
    getAxios()?.post<APIResponse<CreateApiKeyResponse>>(url, payload)
  );
}

/**
 * Revoke an API key (soft-delete, sets revoked_at).
 * Requires a session JWT (not an API key).
 */
export async function revokeApiKey(id: string): Promise<void> {
  const url = `/api/api-key/${id}`;

  return executeAPIVoidRequest(() =>
    getAxios()?.delete<APIResponse<void>>(url)
  );
}
