import { Linking, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const APP_ID = 'com.shoverhub.hostelmanager';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;
const CHECK_CACHE_KEY = '@hostel_manager:update_check_result';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface CachedCheck {
  timestamp: number;
  updateAvailable: boolean;
  storeVersion: string | null;
}

async function fetchPlayStoreVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      `https://play.google.com/store/apps/details?id=${APP_ID}&hl=en`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/"softwareVersion"\s*:\s*"([^"]+)"/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function parseVersion(v: string): [number, number, number] {
  try {
    const parts = v.trim().split('.');
    return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, parseInt(parts[2]) || 0];
  } catch {
    return [0, 0, 0];
  }
}

function isNewer(remote: string, current: string): boolean {
  const [rMajor, rMinor, rPatch] = parseVersion(remote);
  const [cMajor, cMinor, cPatch] = parseVersion(current);
  if (rMajor !== cMajor) return rMajor > cMajor;
  if (rMinor !== cMinor) return rMinor > cMinor;
  return rPatch > cPatch;
}

async function getCachedCheck(): Promise<CachedCheck | null> {
  try {
    const raw = await AsyncStorage.getItem(CHECK_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setCachedCheck(data: CachedCheck): Promise<void> {
  try {
    await AsyncStorage.setItem(CHECK_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function runBackgroundUpdateCheck(): Promise<boolean> {
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const cached = await getCachedCheck();

  if (cached && Date.now() - cached.timestamp < CHECK_INTERVAL_MS) {
    return cached.updateAvailable;
  }

  const storeVersion = await fetchPlayStoreVersion();
  const updateAvailable = storeVersion ? isNewer(storeVersion, currentVersion) : false;

  await setCachedCheck({ timestamp: Date.now(), updateAvailable, storeVersion });
  return updateAvailable;
}

export async function getUpdateStatus(): Promise<{ updateAvailable: boolean; storeVersion: string | null }> {
  const cached = await getCachedCheck();
  return { updateAvailable: cached?.updateAvailable || false, storeVersion: cached?.storeVersion || null };
}

export async function clearUpdateFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHECK_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function checkForUpdates(): Promise<{ updateAvailable: boolean; currentVersion: string; storeVersion: string | null; storeUrl: string }> {
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const storeVersion = await fetchPlayStoreVersion();
  const updateAvailable = storeVersion ? isNewer(storeVersion, currentVersion) : false;

  if (storeVersion) {
    await setCachedCheck({ timestamp: Date.now(), updateAvailable, storeVersion });
  }

  return { updateAvailable, currentVersion, storeVersion, storeUrl: PLAY_STORE_URL };
}

export async function openPlayStore(url?: string) {
  await Linking.openURL(url || PLAY_STORE_URL);
}

export function setupBackgroundCheck() {
  let isChecking = false;

  const doCheck = async () => {
    if (isChecking) return;
    isChecking = true;
    try {
      await runBackgroundUpdateCheck();
    } finally {
      isChecking = false;
    }
  };

  // Run immediately on setup
  doCheck();

  // Run when app returns to foreground
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      doCheck();
    }
  });

  return () => subscription.remove();
}
