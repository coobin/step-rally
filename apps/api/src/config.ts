import process from 'node:process'

export type AuthMode = 'oidc' | 'mock' | 'all'

function text(name: string, fallback = ''): string {
  return String(process.env[name] ?? fallback).trim()
}

function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(text(name), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function list(name: string): string[] {
  return [...new Set(text(name).split(',').map((item) => item.trim()).filter(Boolean))]
}

const authModeEnv = text('AUTH_MODE', 'all').toLowerCase()
const authMode = (authModeEnv === 'oidc' || authModeEnv === 'mock' ? authModeEnv : 'all') as AuthMode

export const appConfig = {
  host: text('BIND_HOST', '0.0.0.0'),
  port: integer('PORT', 8095, 1, 65535),
  publicDir: text('PUBLIC_DIR', 'apps/web/dist'),
  dataFile: text('DATA_FILE', 'data/rally.json'),
  auth: {
    mode: authMode,
    adminPassword: text('ADMIN_PASSWORD', 'admin888'),
    issuer: text('OIDC_ISSUER', '').replace(/\/$/, ''),
    clientId: text('OIDC_CLIENT_ID', 'step-rally'),
    clientSecret: text('OIDC_CLIENT_SECRET', ''),
    redirectUri: text('OIDC_REDIRECT_URI', ''),
    scopes: text('OIDC_SCOPES', 'openid profile email'),
    usernameClaim: text('OIDC_USERNAME_CLAIM', 'preferred_username'),
    sessionSecret: text('SESSION_SECRET', 'step-rally-universal-session-secret-2026!'),
    sessionTtlMs: integer('SESSION_TTL_MS', 7 * 24 * 60 * 60 * 1000, 300000, 30 * 24 * 60 * 60 * 1000),
    cookieSecure: process.env.SECURE_COOKIES === 'true',
    adminUsernames: list('ADMIN_USERNAMES').length > 0 ? list('ADMIN_USERNAMES') : ['admin'],
  },
  ldap: {
    enabled: text('ENABLE_LDAP', 'false') === 'true',
    uri: text('LDAP_URI', ''),
    baseDn: text('LDAP_BASE_DN', ''),
    bindDn: text('LDAP_BIND_DN', ''),
    bindPassword: text('LDAP_BIND_PASSWORD', ''),
    peopleOu: text('LDAP_PEOPLE_OU', 'ou=people'),
    groupsOu: text('LDAP_GROUPS_OU', 'ou=groups'),
  },
}
