import { getAxios } from '@/application/services/js-services/http/core';

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKey,
  type CreateApiKeyResponse,
} from '../api-key-api';

jest.mock('@/application/services/js-services/http/core', () => ({
  executeAPIRequest: jest.fn(),
  executeAPIVoidRequest: jest.fn(),
  getAxios: jest.fn(),
  parseRetryAfterSecs: jest.fn(),
}));

const mockGetAxios = getAxios as unknown as jest.Mock;

// Pull the mocked helpers so we can drive executeAPIRequest with a known fn.
const { executeAPIRequest, executeAPIVoidRequest } = jest.requireMock(
  '@/application/services/js-services/http/core'
) as {
  executeAPIRequest: jest.Mock;
  executeAPIVoidRequest: jest.Mock;
};

describe('api-key-api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listApiKeys', () => {
    it('GETs /api/api-key and returns the typed list', async () => {
      const get = jest.fn().mockResolvedValue({ status: 200, data: { code: 0 }, headers: {} });
      mockGetAxios.mockReturnValue({ get });

      const keys: ApiKey[] = [
        {
          id: 'k1',
          name: 'factory-prod',
          key_prefix: 'afk_abcdefgh',
          workspace_id: null,
          created_at: '2026-07-28T00:00:00Z',
          expires_at: null,
          last_used_at: null,
          revoked_at: null,
        },
      ];
      // executeAPIRequest invokes the fn we pass and unwraps response.data.data.
      executeAPIRequest.mockImplementation(async (fn: () => Promise<unknown>) => {
        await fn();
        return keys;
      });

      const result = await listApiKeys();

      expect(get).toHaveBeenCalledWith('/api/api-key');
      expect(result).toEqual(keys);
    });
  });

  describe('createApiKey', () => {
    it('POSTs the payload to /api/api-key and returns the typed response', async () => {
      const post = jest.fn().mockResolvedValue({ status: 200, data: { code: 0 }, headers: {} });
      mockGetAxios.mockReturnValue({ post });

      const created: CreateApiKeyResponse = {
        id: 'k1',
        name: 'factory-prod',
        key: 'afk_fullplaintext',
        key_prefix: 'afk_fullpla',
        workspace_id: null,
        created_at: '2026-07-28T00:00:00Z',
        expires_at: null,
      };
      executeAPIRequest.mockImplementation(async (fn: () => Promise<unknown>) => {
        await fn();
        return created;
      });

      const result = await createApiKey({ name: 'factory-prod' });

      expect(post).toHaveBeenCalledWith('/api/api-key', { name: 'factory-prod' });
      expect(result).toEqual(created);
      // Key contract: plaintext is in `key`, prefix in `key_prefix` (not `prefix`).
      expect(result.key).toBe('afk_fullplaintext');
      expect(result.key_prefix).toBe('afk_fullpla');
    });

    it('forwards optional workspace_id and expires_at', async () => {
      const post = jest.fn().mockResolvedValue({ status: 200, data: { code: 0 }, headers: {} });
      mockGetAxios.mockReturnValue({ post });
      executeAPIRequest.mockImplementation(async (fn: () => Promise<unknown>) => {
        await fn();
        return {};
      });

      await createApiKey({
        name: 'scoped',
        workspace_id: 'ws-1',
        expires_at: '2026-12-31T00:00:00Z',
      });

      expect(post).toHaveBeenCalledWith('/api/api-key', {
        name: 'scoped',
        workspace_id: 'ws-1',
        expires_at: '2026-12-31T00:00:00Z',
      });
    });
  });

  describe('revokeApiKey', () => {
    it('DELETEs /api/api-key/{id}', async () => {
      const del = jest.fn().mockResolvedValue({ status: 200, data: { code: 0 }, headers: {} });
      mockGetAxios.mockReturnValue({ delete: del });
      executeAPIVoidRequest.mockImplementation(async (fn: () => Promise<unknown>) => {
        await fn();
        return undefined;
      });

      await revokeApiKey('k1');

      expect(del).toHaveBeenCalledWith('/api/api-key/k1');
    });
  });
});
