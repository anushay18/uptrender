import { API_CONFIG, ENDPOINTS, STORAGE_KEYS } from './config';
import { secureStorage } from './storage';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RequestConfig extends RequestInit {
  params?: Record<string, any>;
  skipAuth?: boolean;
  timeoutMs?: number;
}

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

// Build URL with query params
const buildUrl = (endpoint: string, params?: Record<string, any>): string => {
  const url = new URL(`${API_CONFIG.API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
};

// fetch wrapper with timeout via AbortController
const fetchWithTimeout = async (input: RequestInfo, init: RequestInit = {}, timeoutMs: number = API_CONFIG.TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input as any, { ...init, signal: controller.signal } as any);
    return response;
  } finally {
    clearTimeout(id);
  }
};

// Refresh token
const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      return null;
    }

    // use fetchWithTimeout so token refresh won't hang indefinitely
    const response = await fetchWithTimeout(`${API_CONFIG.API_URL}${ENDPOINTS.AUTH.REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    }, API_CONFIG.TIMEOUT);

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (text) {
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse JSON during token refresh:', text);
          return null;
        }
      } else {
        console.error('Non-JSON token refresh response:', { status: response.status, contentType, text });
        return null;
      }
    } else {
      data = { success: true, data: null };
    }

    if (data.success && data.accessToken) {
      await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      if (data.refreshToken) {
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      }
      return data.accessToken;
    }
    
    return null;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
};

// Main API request function
export const apiRequest = async <T = any>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> => {
  const { params, skipAuth = false, ...fetchConfig } = config;
  
  try {
    const url = buildUrl(endpoint, params);

    // Get auth token
    let token: string | null = null;
    if (!skipAuth) {
      token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    }

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchConfig.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Try requests with a simple retry/backoff for transient network errors
    const maxAttempts = 2;
    let attempt = 0;
    let response: Response | null = null;
    let lastError: any = null;

    while (attempt < maxAttempts) {
      try {
        const timeoutToUse = (fetchConfig as any)?.timeoutMs ?? API_CONFIG.TIMEOUT;
        response = await fetchWithTimeout(url, {
          ...fetchConfig,
          headers,
        }, timeoutToUse);
        break;
      } catch (err: any) {
        lastError = err;
        attempt += 1;
        if (attempt >= maxAttempts) throw err;
        // exponential-ish backoff
        await new Promise((res) => setTimeout(res, 300 * attempt));
      }
    }

    // Handle 401 - Token expired
    if (response && response.status === 401 && !skipAuth) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
          // Retry original request with new token
          (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetchWithTimeout(url, {
            ...fetchConfig,
            headers,
          }, API_CONFIG.TIMEOUT);
          const retryText = await retryResponse.text();
          const retryContentType = retryResponse.headers.get('content-type') || '';
          if (retryText) {
            if (retryContentType.includes('application/json')) {
              try {
                return JSON.parse(retryText);
              } catch (e) {
                console.error('Failed to parse retry JSON response:', retryText);
                return { success: false, error: 'Invalid response from server' };
              }
            } else {
              console.error('Non-JSON retry response:', { status: retryResponse.status, retryText });
              return { success: false, error: `Server returned status ${retryResponse.status}` };
            }
          }
          return { success: true, data: null };
        } else {
          // Refresh failed - clear tokens and redirect to login
          await secureStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          return { success: false, error: 'Session expired. Please login again.' };
        }
      } else {
        // Wait for token refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh(async (newToken) => {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetchWithTimeout(url, {
              ...fetchConfig,
              headers,
            }, API_CONFIG.TIMEOUT);
            const retryText = await retryResponse.text();
            const retryContentType = retryResponse.headers.get('content-type') || '';
            if (retryText) {
              if (retryContentType.includes('application/json')) {
                try {
                  resolve(JSON.parse(retryText));
                } catch (e) {
                  console.error('Failed to parse retry JSON response:', retryText);
                  resolve({ success: false, error: 'Invalid response from server' });
                }
              } else {
                console.error('Non-JSON retry response:', { status: retryResponse.status, retryText });
                resolve({ success: false, error: `Server returned status ${retryResponse.status}` });
              }
            } else {
              resolve({ success: true, data: null });
            }
          });
        });
      }
    }

    // Handle 5xx errors early before trying to parse body
    if (response && response.status >= 500) {
      console.warn('Server error:', { status: response.status, url });
      return { success: false, error: 'Server error. Please try again later.' };
    }

    // Safely parse JSON response
    const text = response ? await response.text() : null;
    let data;
    try {
      const contentType = response?.headers.get('content-type') || '';
      if (text) {
        // Check if response looks like HTML (error page)
        if (text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.warn('Received HTML response instead of JSON:', { status: response?.status, url });
          return { success: false, error: 'Server error. Please try again later.' };
        }
        if (contentType.includes('application/json')) {
          data = JSON.parse(text);
        } else {
          // Non-JSON response (e.g., HTML error page). Log details and return a friendly error.
          console.warn('Non-JSON API response:', { status: response?.status, contentType });
          return { success: false, error: response && response.status >= 500 ? 'Server error. Please try again later.' : `Request failed with status ${response?.status}` };
        }
      } else {
        data = { success: true, data: null };
      }
    } catch (e) {
      console.warn('Failed to parse response as JSON');
      return { success: false, error: 'Invalid response from server' };
    }
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `Request failed with status ${response.status}`,
      };
    }

    return data;
  } catch (error: any) {
    console.error('API request error:', error);
    // If this was an abort/timeout from fetchWithTimeout, normalize message
    const msg = error?.message || '';
    const name = error?.name || '';
    if (msg.includes('Network request timed out') || msg.includes('The user aborted a request') || msg.includes('timeout') || msg.includes('Aborted') || name === 'AbortError') {
      return { success: false, error: 'Network request timed out. Please try again.' };
    }
    return {
      success: false,
      error: error.message || 'Network error. Please check your connection.',
    };
  }
};

// HTTP method helpers
export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>, config?: RequestConfig) =>
    apiRequest<T>(endpoint, { ...config, method: 'GET', params }),

  post: <T = any>(endpoint: string, body?: any, config?: RequestConfig) =>
    apiRequest<T>(endpoint, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, config?: RequestConfig) =>
    apiRequest<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, config?: RequestConfig) =>
    apiRequest<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, config?: RequestConfig) =>
    apiRequest<T>(endpoint, { ...config, method: 'DELETE' }),
};

// File upload helper
export const uploadFile = async (
  endpoint: string,
  file: any,
  fieldName: string = 'file',
  additionalData?: Record<string, any>
): Promise<ApiResponse> => {
  try {
    const token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const formData = new FormData();

    // Add file
    formData.append(fieldName, {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: file.fileName || 'file.jpg',
    } as any);

    // Add additional data
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await fetch(`${API_CONFIG.API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - let fetch handle it for FormData
      },
      body: formData,
    });

    return await response.json();
  } catch (error: any) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error.message || 'File upload failed',
    };
  }
};
