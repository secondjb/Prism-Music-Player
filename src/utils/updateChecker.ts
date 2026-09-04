import { openUrl } from '@tauri-apps/plugin-opener';

export const CURRENT_APP_VERSION = 'v0.1.0';
export const GITHUB_REPO = 'secondjb/Prism-Music-Player';
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string;
  assets: ReleaseAsset[];
  checkedAt: number;
  error?: string;
}

/**
 * Compare two semver strings like "v0.1.0" and "v0.2.0"
 * Returns 1 if vA > vB, -1 if vA < vB, 0 if equal
 */
export function compareVersions(vA: string, vB: string): number {
  const cleanA = vA.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const cleanB = vB.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(cleanA.length, cleanB.length); i++) {
    const a = cleanA[i] || 0;
    const b = cleanB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export async function openExternalLink(url: string) {
  try {
    if (window.__TAURI_INTERNALS__) {
      await openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  } catch (e) {
    window.open(url, '_blank');
  }
}

export async function fetchLatestRelease(): Promise<UpdateCheckResult> {
  const now = Date.now();
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Prism-Music-Player-Update-Checker',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          hasUpdate: false,
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: CURRENT_APP_VERSION,
          releaseName: 'No published releases yet',
          releaseNotes: '',
          releaseUrl: GITHUB_RELEASES_URL,
          publishedAt: '',
          assets: [],
          checkedAt: now,
          error: 'No releases published on GitHub yet.',
        };
      }
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const data = await response.json();
    const latestVersion = data.tag_name || data.name || CURRENT_APP_VERSION;
    const hasUpdate = compareVersions(latestVersion, CURRENT_APP_VERSION) > 0;

    const assets: ReleaseAsset[] = Array.isArray(data.assets)
      ? data.assets.map((a: any) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: a.size,
        }))
      : [];

    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      releaseName: data.name || latestVersion,
      releaseNotes: data.body || '',
      releaseUrl: data.html_url || GITHUB_RELEASES_URL,
      publishedAt: data.published_at || '',
      assets,
      checkedAt: now,
    };
  } catch (err: any) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      releaseName: '',
      releaseNotes: '',
      releaseUrl: GITHUB_RELEASES_URL,
      publishedAt: '',
      assets: [],
      checkedAt: now,
      error: err?.message || 'Unable to connect to GitHub releases.',
    };
  }
}
