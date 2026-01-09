import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface ApiKey {
  id: number;
  userId: number;
  name?: string;
  segment: 'Crypto' | 'Forex' | 'Indian';
  broker: string;
  exchangeId?: string;
  accountType?: 'spot' | 'future' | 'swap' | 'margin';
  apiKey: string;
  apiSecret?: string;
  passphrase?: string;
  accessToken?: string;
  status: 'Active' | 'Pending' | 'Inactive';
  balance?: number;
  isDefault: boolean;
  lastVerified?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyData {
  name?: string;
  segment: 'Crypto' | 'Forex' | 'Indian';
  broker: string;
  exchangeId?: string;
  accountType?: 'spot' | 'future' | 'swap' | 'margin';
  apiKey: string;
  apiSecret?: string;
  passphrase?: string;
  accessToken?: string;
}

export interface ApiKeyFilters {
  segment?: string;
  status?: string;
  isDefault?: boolean;
}

export const apiKeyService = {
  // Get all API keys
  async getApiKeys(filters?: ApiKeyFilters): Promise<ApiResponse<ApiKey[]>> {
    return await api.get<ApiKey[]>(ENDPOINTS.API_KEYS.LIST, filters);
  },

  // Get API key by ID
  async getApiKeyById(id: number): Promise<ApiResponse<ApiKey>> {
    return await api.get<ApiKey>(ENDPOINTS.API_KEYS.BY_ID(id));
  },

  // Create API key
  async createApiKey(data: CreateApiKeyData): Promise<ApiResponse<ApiKey>> {
    // Creating an API key may trigger backend work (charges, verifications).
    // Use a longer timeout for this endpoint to avoid client-side aborts.
    return await api.post<ApiKey>(ENDPOINTS.API_KEYS.LIST, data, { timeoutMs: 60000 });
  },

  // Update API key
  async updateApiKey(id: number, data: Partial<CreateApiKeyData>): Promise<ApiResponse<ApiKey>> {
    return await api.put<ApiKey>(ENDPOINTS.API_KEYS.BY_ID(id), data);
  },

  // Delete API key
  async deleteApiKey(id: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.API_KEYS.BY_ID(id));
  },

  // Verify API key connection
  async verifyApiKey(id: number): Promise<ApiResponse<{ isValid: boolean; balance?: number }>> {
    return await api.post(ENDPOINTS.API_KEYS.VERIFY(id));
  },

  // Refresh API key balance
  async refreshBalance(id: number): Promise<ApiResponse<{ balance: number }>> {
    return await api.post(ENDPOINTS.API_KEYS.REFRESH_BALANCE(id));
  },

  // Set API key as default
  async setAsDefault(id: number): Promise<ApiResponse<ApiKey>> {
    return await api.post<ApiKey>(ENDPOINTS.API_KEYS.SET_DEFAULT(id));
  },

  // Test API key connection
  async testConnection(id: number): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await api.post(ENDPOINTS.API_KEYS.TEST(id));
  },
};

export default apiKeyService;
