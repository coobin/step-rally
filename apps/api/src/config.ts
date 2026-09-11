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
    issuer: text('OIDC_ISSUER', 'https://auth.example.com').replace(/\/$/, ''),
    clientId: text('OIDC_CLIENT_ID', 'walk-rally'),
    clientSecret: text('OIDC_CLIENT_SECRET', ''),
    redirectUri: text('OIDC_REDIRECT_URI', 'http://localhost:8095/api/v1/auth/oidc/callback'),
    scopes: text('OIDC_SCOPES', 'openid profile email groups'),
    usernameClaim: text('OIDC_USERNAME_CLAIM', 'preferred_username'),
    sessionSecret: text('SESSION_SECRET', 'change-me-in-production-rally-secret-2026!'),
    sessionTtlMs: integer('SESSION_TTL_MS', 7 * 24 * 60 * 60 * 1000, 300000, 30 * 24 * 60 * 60 * 1000),
    cookieSecure: process.env.SECURE_COOKIES === 'true',
    adminUsernames: list('ADMIN_USERNAMES').length > 0 ? list('ADMIN_USERNAMES') : ['admin'],
  },
  ldap: {
    uri: text('LDAP_URI', ''),
    baseDn: text('LDAP_BASE_DN', 'dc=example,dc=com'),
    bindDn: text('LDAP_BIND_DN', ''),
    bindPassword: text('LDAP_BIND_PASSWORD', ''),
    peopleOu: text('LDAP_PEOPLE_OU', 'ou=people'),
    groupsOu: text('LDAP_GROUPS_OU', 'ou=groups'),
  },
}
