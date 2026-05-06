import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = '@hostel_manager:access_token';
const REFRESH_TOKEN_KEY = '@hostel_manager:refresh_token';
const ACCESS_TOKEN_EXPIRY_KEY = '@hostel_manager:access_token_expiry';
const REFRESH_TOKEN_EXPIRY_KEY = '@hostel_manager:refresh_token_expiry';
const USER_PROFILE_KEY = '@hostel_manager:user_profile';
const DEVICE_ID_KEY = '@hostel_manager:device_id_token';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'hostel_manager_auth',
};

const USE_SECURE_STORE = Platform.OS !== 'web';

// Backend can return Unix time in seconds; normalize to milliseconds for Date.now() comparisons.
function normalizeExpiryToMs(rawExpiry: number): number {
  return rawExpiry < 1_000_000_000_000 ? rawExpiry * 1000 : rawExpiry;
}

async function secureSetItem(key: string, value: string): Promise<void> {
  // Always write to AsyncStorage as a reliable backup for when SecureStore
  // is temporarily unavailable (Android Keystore intermittency).
  await AsyncStorage.setItem(key, value);
  if (USE_SECURE_STORE) {
    try {
      await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    } catch {
      // SecureStore failed; AsyncStorage backup is already written above.
    }
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  if (USE_SECURE_STORE) {
    try {
      const secureValue = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
      if (secureValue !== null) {
        return secureValue;
      }
    } catch {
      // SecureStore unavailable; fall through to AsyncStorage backup.
    }
  }
  // AsyncStorage backup (always kept in sync by secureSetItem dual-write).
  return AsyncStorage.getItem(key);
}

async function secureRemoveItem(key: string): Promise<void> {
  if (USE_SECURE_STORE) {
    try {
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    } catch {
      // Continue to AsyncStorage cleanup.
    }
  }
  await AsyncStorage.removeItem(key);
}

export const encryptedTokenStorage = {
  /**
   * Store access token securely
   */
  async setAccessToken(token: string): Promise<void> {
    try {
      await secureSetItem(ACCESS_TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store access token:', error);
      throw error;
    }
  },

  /**
   * Retrieve access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await secureGetItem(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve access token:', error);
      return null;
    }
  },

  /**
   * Store refresh token securely
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      await secureSetItem(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store refresh token:', error);
      throw error;
    }
  },

  /**
   * Retrieve refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await secureGetItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      return null;
    }
  },

  /**
   * Store access token expiry timestamp (extracted from JWT exp claim)
   */
  async setAccessTokenExpiry(expiresAt: number): Promise<void> {
    try {
      const normalized = normalizeExpiryToMs(expiresAt);
      await AsyncStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, normalized.toString());
    } catch (error) {
      console.error('Failed to store access token expiry:', error);
    }
  },

  /**
   * Retrieve access token expiry timestamp
   */
  async getAccessTokenExpiry(): Promise<number | null> {
    try {
      const expiry = await AsyncStorage.getItem(ACCESS_TOKEN_EXPIRY_KEY);
      if (!expiry) return null;
      const parsed = parseInt(expiry, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Store refresh token expiry timestamp (from API expiresAt field)
   */
  async setRefreshTokenExpiry(expiresAt: number): Promise<void> {
    try {
      const normalized = normalizeExpiryToMs(expiresAt);
      await AsyncStorage.setItem(REFRESH_TOKEN_EXPIRY_KEY, normalized.toString());
    } catch (error) {
      console.error('Failed to store refresh token expiry:', error);
    }
  },

  /**
   * Retrieve refresh token expiry timestamp
   */
  async getRefreshTokenExpiry(): Promise<number | null> {
    try {
      const expiry = await AsyncStorage.getItem(REFRESH_TOKEN_EXPIRY_KEY);
      if (!expiry) return null;
      const parsed = parseInt(expiry, 10);
      return Number.isFinite(parsed) ? normalizeExpiryToMs(parsed) : null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Store token expiry timestamp (legacy — writes to both access and refresh expiry for backward compat)
   */
  async setTokenExpiry(expiresAt: number): Promise<void> {
    await Promise.all([
      this.setAccessTokenExpiry(expiresAt),
      this.setRefreshTokenExpiry(expiresAt),
    ]);
  },

  /**
   * Retrieve token expiry timestamp (legacy — returns access token expiry)
   */
  async getTokenExpiry(): Promise<number | null> {
    return this.getAccessTokenExpiry();
  },

  /**
   * Store device ID associated with current tokens
   * Used to prevent token usage on unauthorized devices
   */
  async setDeviceIdForTokens(deviceId: string): Promise<void> {
    try {
      await secureSetItem(DEVICE_ID_KEY, deviceId);
    } catch (error) {
      console.error('Failed to store device ID:', error);
      throw error;
    }
  },

  /**
   * Retrieve device ID associated with tokens
   */
  async getDeviceIdForTokens(): Promise<string | null> {
    try {
      return await secureGetItem(DEVICE_ID_KEY);
    } catch (error) {
      console.error('Failed to retrieve device ID:', error);
      return null;
    }
  },

  /**
   * Cache user profile for instant display on app resume
   */
  async cacheUserProfile(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to cache user profile:', error);
    }
  },

  /**
   * Retrieve cached user profile
   */
  async getCachedUserProfile(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  },

  /**
   * Clear all tokens and cached user data immediately
   */
  async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        secureRemoveItem(ACCESS_TOKEN_KEY),
        secureRemoveItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(ACCESS_TOKEN_EXPIRY_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_EXPIRY_KEY),
        AsyncStorage.removeItem(USER_PROFILE_KEY),
        secureRemoveItem(DEVICE_ID_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
      throw error;
    }
  },

  /**
   * Check if access token is still valid (not expired)
   * Uses access token expiry (15 min), NOT refresh token expiry (30 days)
   */
  async isTokenValid(): Promise<boolean> {
    try {
      const expiry = await this.getAccessTokenExpiry();
      if (!expiry) return false;
      // Add 10-second buffer to account for clock skew
      return Date.now() < (expiry - 10000);
    } catch (error) {
      return false;
    }
  },

  /**
   * Check if token is close to expiry (for proactive refresh)
   * Returns true if token expires in less than 5 minutes
   */
  async isTokenNearExpiry(): Promise<boolean> {
    try {
      const expiry = await this.getTokenExpiry();
      if (!expiry) return true;
      const timeUntilExpiry = expiry - Date.now();
      return timeUntilExpiry < 5 * 60 * 1000; // 5 minutes
    } catch (error) {
      return true;
    }
  },

  /**
   * Get time remaining until token expiry (in milliseconds)
   */
  async getTimeUntilExpiry(): Promise<number> {
    try {
      const expiry = await this.getTokenExpiry();
      if (!expiry) return 0;
      return Math.max(0, expiry - Date.now());
    } catch (error) {
      return 0;
    }
  },
};
