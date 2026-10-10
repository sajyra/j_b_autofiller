import { CandidateProfile, DEFAULT_PROFILE } from '../types/profile';

const STORAGE_KEY = 'instapp_candidate_profiles';
const ACTIVE_PROFILE_ID_KEY = 'instapp_active_profile_id';

declare const browser: any;

// Check if extension storage is available
const isExtensionStorageAvailable = (): boolean => {
  if (typeof browser !== 'undefined' && !!browser.storage && !!browser.storage.local) {
    return true;
  }
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
};

async function getStorageItem(key: string): Promise<any> {
  if (typeof browser !== 'undefined' && browser.storage?.local?.get) {
    const res = await browser.storage.local.get(key);
    return res?.[key];
  }
  if (typeof chrome !== 'undefined' && !!chrome.storage?.local) {
    return new Promise((resolve) => {
      try {
        let resolved = false;
        const maybePromise: any = (chrome.storage.local as any).get(key, (res: any) => {
          if (!resolved) {
            resolved = true;
            resolve(res?.[key]);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then((res: any) => {
              if (!resolved) {
                resolved = true;
                resolve(res?.[key]);
              }
            })
            .catch(() => {
              if (!resolved) {
                resolved = true;
                resolve(undefined);
              }
            });
        }
      } catch {
        resolve(undefined);
      }
    });
  }
  return undefined;
}

async function setStorageItem(items: Record<string, any>): Promise<void> {
  if (typeof browser !== 'undefined' && browser.storage?.local?.set) {
    await browser.storage.local.set(items);
    return;
  }
  if (typeof chrome !== 'undefined' && !!chrome.storage?.local) {
    return new Promise((resolve) => {
      try {
        let resolved = false;
        const maybePromise: any = (chrome.storage.local as any).set(items, () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then(() => {
              if (!resolved) {
                resolved = true;
                resolve();
              }
            })
            .catch(() => {
              if (!resolved) {
                resolved = true;
                resolve();
              }
            });
        }
      } catch {
        resolve();
      }
    });
  }
}

/**
 * Get all saved profiles. Defaults to a single default profile if none exists.
 */
export async function getAllProfiles(): Promise<CandidateProfile[]> {
  try {
    if (isExtensionStorageAvailable()) {
      const profiles = await getStorageItem(STORAGE_KEY);
      if (Array.isArray(profiles) && profiles.length > 0) {
        return profiles;
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[Instapp] Failed to load profiles, falling back to default', err);
  }

  // Initial setup: save default profile
  const initial = [{ ...DEFAULT_PROFILE }];
  await saveAllProfiles(initial);
  return initial;
}

/**
 * Save all profiles array
 */
export async function saveAllProfiles(profiles: CandidateProfile[]): Promise<void> {
  try {
    if (isExtensionStorageAvailable()) {
      await setStorageItem({ [STORAGE_KEY]: profiles });
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    }
  } catch (err) {
    console.error('[Instapp] Failed to save profiles', err);
    throw err;
  }
}

/**
 * Get currently active profile
 */
export async function getActiveProfile(): Promise<CandidateProfile> {
  const profiles = await getAllProfiles();
  let activeId: string | null = null;

  try {
    if (isExtensionStorageAvailable()) {
      activeId = await getStorageItem(ACTIVE_PROFILE_ID_KEY);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      activeId = window.localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    }
  } catch (e) {
    console.warn('[Instapp] Error reading active profile ID', e);
  }

  if (activeId) {
    const found = profiles.find((p) => p.id === activeId);
    if (found) return found;
  }

  // Fallback to default or first
  const def = profiles.find((p) => p.isDefault) || profiles[0] || DEFAULT_PROFILE;
  return def;
}

/**
 * Save or update the active profile
 */
export async function saveActiveProfile(profile: CandidateProfile): Promise<void> {
  const profiles = await getAllProfiles();
  const updatedProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  const index = profiles.findIndex((p) => p.id === profile.id);
  if (index >= 0) {
    profiles[index] = updatedProfile;
  } else {
    profiles.push(updatedProfile);
  }

  await saveAllProfiles(profiles);

  if (isExtensionStorageAvailable()) {
    await setStorageItem({ [ACTIVE_PROFILE_ID_KEY]: profile.id });
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profile.id);
  }
}

/**
 * Export active profile as JSON string
 */
export function exportProfileJSON(profile: CandidateProfile): string {
  return JSON.stringify(profile, null, 2);
}

/**
 * Import profile from JSON string
 */
export async function importProfileJSON(jsonString: string): Promise<CandidateProfile> {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON format: Expected profile object.');
  }

  // Merge with default schema to ensure all keys exist
  const importedProfile: CandidateProfile = {
    ...DEFAULT_PROFILE,
    ...parsed,
    id: parsed.id || `profile-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    personal: { ...DEFAULT_PROFILE.personal, ...(parsed.personal || {}) },
    links: { ...DEFAULT_PROFILE.links, ...(parsed.links || {}) },
    workAuth: { ...DEFAULT_PROFILE.workAuth, ...(parsed.workAuth || {}) },
    eeo: { ...DEFAULT_PROFILE.eeo, ...(parsed.eeo || {}) },
    experience: { ...DEFAULT_PROFILE.experience, ...(parsed.experience || {}) },
    customQA: Array.isArray(parsed.customQA) ? parsed.customQA : [],
  };

  await saveActiveProfile(importedProfile);
  return importedProfile;
}
