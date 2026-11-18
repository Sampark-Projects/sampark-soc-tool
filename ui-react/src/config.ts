// The original landing page used *_REPLACER tokens that nginx filled in at container start.
// In React these come from an optional /config.json served next to the app (same keys),
// with the defaults below used when the file is missing.
export interface AppConfig {
  version: string
  dashboardsUrl: string
  dashboardsName: string
  dashboardsIcon: string
  netboxUrl: string
  netboxTitle: string
  netboxDesc: string
  authUrl: string
  authTitle: string
  authDesc: string
}

export const defaultConfig: AppConfig = {
  version: '',
  dashboardsUrl: '/dashboards/',
  dashboardsName: 'Dashboards',
  dashboardsIcon: 'opensearch_dashboards.svg',
  netboxUrl: '/assetregistry/',
  netboxTitle: 'AssetRegistry',
  netboxDesc: 'Model and visualize assets and network infrastructure',
  authUrl: '/auth/',
  authTitle: 'Account Management',
  authDesc: 'Manage accounts and user permissions',
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (!res.ok) return defaultConfig
    return { ...defaultConfig, ...(await res.json()) }
  } catch {
    return defaultConfig
  }
}
