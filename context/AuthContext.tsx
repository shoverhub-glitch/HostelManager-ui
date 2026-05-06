import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { encryptedTokenStorage } from '@/services/encryptedTokenStorage';
import { deviceIdService } from '@/services/deviceId';
import { authService, refreshAccessToken } from '@/services/apiClient';
import type { Owner } from '@/services/apiTypes';
import { clearScreenCache } from '@/services/screenCache';
import { propertyStorage } from '@/services/propertyStorage';

interface AuthContextType {
  user: Owner | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (user: Owner) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auto-refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;
// Minimum 10 seconds between refresh attempts to prevent hammering the server
const MIN_REFRESH_INTERVAL = 10 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Owner | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef<AppStateStatus>('active');
  const tokenRefreshTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      scheduleTokenRefresh();
    }
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }
    };
  }, [isAuthenticated]);

  const initializeAuth = async () => {
    try {
      const deviceId = await deviceIdService.getOrCreateDeviceId();
      const token = await encryptedTokenStorage.getAccessToken();
      const refreshToken = await encryptedTokenStorage.getRefreshToken();

      if (!token || !refreshToken) {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
        return;
      }

      // Restore cached user profile for instant greeting display
      const cachedUser = await encryptedTokenStorage.getCachedUserProfile();
      if (cachedUser) {
        setUser(cachedUser);
      }

      const isAccessTokenValid = await encryptedTokenStorage.isTokenValid();

      if (isAccessTokenValid) {
        // Access token is valid — show dashboard immediately, fetch fresh user in background
        setIsAuthenticated(true);
        setLoading(false);

        try {
          const response = await authService.getCurrentUser();
          setUser(response.data);
          await encryptedTokenStorage.cacheUserProfile(response.data);
          scheduleTokenRefresh();
        } catch (error: any) {
          if (error?.code === 'UNAUTHORIZED' || error?.details?.status === 401) {
            await encryptedTokenStorage.clearTokens();
            setIsAuthenticated(false);
            setUser(null);
            setLoading(false);
          } else {
            // Network or other error — stay logged in with cached/stale user
            scheduleTokenRefresh();
          }
        }
      } else {
        // Access token expired — refresh before showing dashboard
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          setIsAuthenticated(true);
          if (refreshed.user) {
            setUser(refreshed.user);
            await encryptedTokenStorage.cacheUserProfile(refreshed.user);
          }
          setLoading(false);
          scheduleTokenRefresh();
        } else {
          // Refresh failed — check if refresh token still exists (transient failure vs revoked)
          const remainingRefreshToken = await encryptedTokenStorage.getRefreshToken();
          if (!remainingRefreshToken) {
            // Refresh token revoked or expired — log out
            await encryptedTokenStorage.clearTokens();
            setIsAuthenticated(false);
            setUser(null);
          } else {
            // Transient failure — show dashboard with cached user, retry later
            if (cachedUser) {
              setIsAuthenticated(true);
              scheduleTokenRefresh();
            } else {
              await encryptedTokenStorage.clearTokens();
              setIsAuthenticated(false);
              setUser(null);
            }
          }
          setLoading(false);
        }
      }
    } catch (error) {
      const token = await encryptedTokenStorage.getAccessToken();
      if (token) {
        const cachedUser = await encryptedTokenStorage.getCachedUserProfile();
        if (cachedUser) setUser(cachedUser);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setLoading(false);
    }
  };

  const scheduleTokenRefresh = async () => {
    try {
      const expiry = await encryptedTokenStorage.getAccessTokenExpiry();
      if (!expiry) return;

      const timeUntilExpiry = expiry - Date.now();
      
      if (timeUntilExpiry <= 0) {
        return;
      }

      let refreshTime = Math.max(MIN_REFRESH_INTERVAL, timeUntilExpiry - TOKEN_REFRESH_BUFFER);
      
      if (refreshTime < MIN_REFRESH_INTERVAL) {
        refreshTime = MIN_REFRESH_INTERVAL;
      }

      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }

      tokenRefreshTimerRef.current = setTimeout(async () => {
        const result = await refreshAccessToken();
        if (result) {
          if (result.user) {
            setUser(result.user);
            await encryptedTokenStorage.cacheUserProfile(result.user);
          }
          scheduleTokenRefresh();
        } else {
          const remainingRefreshToken = await encryptedTokenStorage.getRefreshToken();
          if (!remainingRefreshToken) {
            setIsAuthenticated(false);
            setUser(null);
          } else {
            tokenRefreshTimerRef.current = setTimeout(() => scheduleTokenRefresh(), 30_000);
          }
        }
      }, refreshTime);
    } catch (error) {
      // Silently fail scheduling
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const prevAppState = appStateRef.current;
    appStateRef.current = nextAppState;

    if (prevAppState === 'background' && nextAppState === 'active') {
      if (isAuthenticated) {
        const isValid = await encryptedTokenStorage.isTokenValid();
        if (!isValid) {
          const result = await refreshAccessToken();
          if (result) {
            if (result.user) {
              setUser(result.user);
              await encryptedTokenStorage.cacheUserProfile(result.user);
            }
            scheduleTokenRefresh();
          } else {
            const remainingRefreshToken = await encryptedTokenStorage.getRefreshToken();
            if (!remainingRefreshToken) {
              setIsAuthenticated(false);
              setUser(null);
            } else {
              scheduleTokenRefresh();
            }
          }
        }
      }
    }
  };

  const login = (userData: Owner) => {
    clearScreenCache();
    setUser(userData);
    setIsAuthenticated(true);
    encryptedTokenStorage.cacheUserProfile(userData);
    scheduleTokenRefresh();
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Silently handle logout errors
    } finally {
      await encryptedTokenStorage.clearTokens();
      await propertyStorage.clearSelectedPropertyId();
      clearScreenCache();
      setUser(null);
      setIsAuthenticated(false);
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
