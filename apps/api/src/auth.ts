import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { appConfig } from './config.ts'

const sessionCookieName = 'rally_session'
const oidcStateCookieName = 'rally_oidc_state'
const authPrefix = '/api/v1/auth'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  email?: string
  roles: string[]
  authSource: 'oidc' | 'mock'
}

export interface AuthRouteResponse {
  status: number
  headers?: Record<string, string | string[]>
  body?: unknown
}

interface SignedSession {
  exp: number
  user: AuthUser
}

interface OidcState {
  exp: number
  state: string
  nonce: string
  codeVerifier: string
}

interface OidcDiscovery {
  issuer?: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  userinfo_endpoint?: string
}

export function jsonResponse(status: number, body: unknown): AuthRouteResponse {
  return {
    status,
    body,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  }
}

function base64Url(value: Uint8Array | string): string {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function sign(value: string): string {
  return base64Url(createHmac('sha256', appConfig.auth.sessionSecret).update(value).digest())
}

export function signedValue<T extends object>(value: T): string {
  const payload = base64Url(JSON.stringify(value))
  return `${payload}.${sign(payload)}`
}

export function verifySigned<T extends object>(value: string | undefined): T | null {
  if (!value || !appConfig.auth.sessionSecret) return null
  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null
  const payload = value.slice(0, separator)
  const supplied = value.slice(separator + 1)
  const expected = sign(payload)
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return null
  }
  try {
    const result = JSON.parse(decodeBase64Url(payload).toString('utf8')) as T
    return result && typeof result === 'object' ? result : null
  } catch {
    return null
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (header ?? '')
      .split(';')
      .map((item) => {
        const separator = item.indexOf('=')
        if (separator <= 0) return ['', '']
        const name = item.slice(0, separator).trim()
        const rawValue = item.slice(separator + 1).trim()
        try {
          return [name, decodeURIComponent(rawValue)]
        } catch {
          return ['', '']
        }
      })
      .filter(([name]) => Boolean(name)),
  )
}

export function cookie(name: string, value: string, maxAge: number, path = '/'): string {
  const secure = appConfig.auth.cookieSecure ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; SameSite=Lax${secure}`
}

export function clearCookie(name: string, path = '/'): string {
  return cookie(name, '', 0, path)
}

export function currentUser(request: IncomingMessage): AuthUser | null {
  const cookies = parseCookies(request.headers.cookie)
  const session = verifySigned<SignedSession>(cookies[sessionCookieName])
  if (!session || !session.user || typeof session.exp !== 'number' || session.exp <= Date.now()) {
    return null
  }
  return session.user
}

export function isUserAdmin(username: string): boolean {
  return appConfig.auth.adminUsernames.includes(username.toLowerCase())
}

let discoveryCache: { value: OidcDiscovery; expiresAt: number } | null = null
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function discoveryUrl(): string {
  return `${appConfig.auth.issuer}/.well-known/openid-configuration`
}

async function oidcDiscovery(): Promise<OidcDiscovery> {
  if (discoveryCache && discoveryCache.expiresAt > Date.now()) {
    return discoveryCache.value
  }
  const response = await fetch(discoveryUrl(), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`OIDC discovery HTTP ${response.status}`)
  const value = (await response.json()) as Partial<OidcDiscovery>
  if (!value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) {
    throw new Error('OIDC discovery 缺少必要端点')
  }
  const result = value as OidcDiscovery
  discoveryCache = { value: result, expiresAt: Date.now() + 10 * 60 * 1000 }
  return result
}

function codeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}

function claimText(claims: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = claims[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function resolveRedirectUri(request?: IncomingMessage): string {
  if (request) {
    const host = (request.headers['x-forwarded-host'] || request.headers.host || '') as string
    if (host) {
      const cleanHost = host.split(',')[0].trim()
      const proto = (request.headers['x-forwarded-proto'] || (cleanHost.startsWith('localhost') || cleanHost.startsWith('127.0.0.1') ? 'http' : 'https')) as string
      return `${proto}://${cleanHost}${authPrefix}/oidc/callback`
    }
  }
  return appConfig.auth.redirectUri || 'http://localhost:8095/api/v1/auth/oidc/callback'
}

export async function oidcLogin(request?: IncomingMessage): Promise<AuthRouteResponse> {
  try {
    const discovery = await oidcDiscovery()
    const redirectUri = resolveRedirectUri(request)
    const state: OidcState = {
      exp: Date.now() + 10 * 60 * 1000,
      state: base64Url(randomBytes(32)),
      nonce: base64Url(randomBytes(32)),
      codeVerifier: base64Url(randomBytes(48)),
    }
    const authorization = new URL(discovery.authorization_endpoint)
    authorization.searchParams.set('client_id', appConfig.auth.clientId)
    authorization.searchParams.set('redirect_uri', redirectUri)
    authorization.searchParams.set('response_type', 'code')
    authorization.searchParams.set('scope', appConfig.auth.scopes)
    authorization.searchParams.set('state', state.state)
    authorization.searchParams.set('nonce', state.nonce)
    authorization.searchParams.set('code_challenge', codeChallenge(state.codeVerifier))
    authorization.searchParams.set('code_challenge_method', 'S256')

    return {
      status: 302,
      headers: {
        location: authorization.toString(),
        'set-cookie': cookie(oidcStateCookieName, signedValue(state), 600, authPrefix),
      },
    }
  } catch (err: any) {
    console.error('OIDC login initiation failed:', err?.message || err)
    return jsonResponse(502, {
      error: {
        code: 'OIDC_UNAVAILABLE',
        message: 'OIDC 服务连接失败或尚未登记客户端，请联系管理员或使用快速登录',
      },
    })
  }
}

export async function oidcCallback(request: IncomingMessage, requestUrl: URL): Promise<AuthRouteResponse> {
  const clearState = clearCookie(oidcStateCookieName, authPrefix)
  try {
    if (requestUrl.searchParams.get('error')) {
      const desc = requestUrl.searchParams.get('error_description') || '登录已被取消或授权失败'
      return { status: 302, headers: { location: `/?error=${encodeURIComponent(desc)}`, 'set-cookie': clearState } }
    }
    const code = requestUrl.searchParams.get('code') ?? ''
    const returnedState = requestUrl.searchParams.get('state') ?? ''
    const stateCookie = parseCookies(request.headers.cookie)[oidcStateCookieName]
    const state = verifySigned<OidcState>(stateCookie)
    if (!code || !returnedState || !state || state.exp <= Date.now() || state.state !== returnedState) {
      return { status: 302, headers: { location: '/?error=OIDC_STATE_EXPIRED', 'set-cookie': clearState } }
    }

    const discovery = await oidcDiscovery()
    const redirectUri = resolveRedirectUri(request)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: appConfig.auth.clientId,
      code_verifier: state.codeVerifier,
    })

    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    }
    if (appConfig.auth.clientSecret) {
      const basic = Buffer.from(`${appConfig.auth.clientId}:${appConfig.auth.clientSecret}`).toString('base64')
      headers.authorization = `Basic ${basic}`
    }

    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    })

    if (!tokenResponse.ok) {
      throw new Error(`Token HTTP ${tokenResponse.status}`)
    }
    const token = (await tokenResponse.json()) as { id_token?: string; access_token?: string }
    if (!token.id_token) throw new Error('Response 缺少 id_token')

    const issuer = discovery.issuer ?? appConfig.auth.issuer
    jwks ??= createRemoteJWKSet(new URL(discovery.jwks_uri))
    const verified = await jwtVerify(token.id_token, jwks, { issuer, audience: appConfig.auth.clientId })
    if (verified.payload.nonce !== state.nonce) {
      throw new Error('Nonce mismatch')
    }

    const claims = verified.payload as Record<string, unknown>
    let userClaims = { ...claims }

    if (discovery.userinfo_endpoint && token.access_token) {
      try {
        const userInfoRes = await fetch(discovery.userinfo_endpoint, {
          headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        })
        if (userInfoRes.ok) {
          userClaims = { ...userClaims, ...(await userInfoRes.json() as Record<string, unknown>) }
        }
      } catch (e) {
        console.warn('UserInfo fetch error:', e)
      }
    }

    const username = claimText(userClaims, [appConfig.auth.usernameClaim, 'preferred_username', 'username', 'email', 'sub'])
    if (!username) throw new Error('缺少有效用户名')

    // 优先提取中文姓名：name, displayName, preferred_username
    const displayName = claimText(userClaims, ['name', 'displayName', 'given_name', 'nickname']) || username
    const email = claimText(userClaims, ['email']) || undefined

    const roles: string[] = []
    if (isUserAdmin(username)) {
      roles.push('admin')
    }

    const user: AuthUser = {
      id: claimText(userClaims, ['sub']) || username,
      username,
      displayName,
      email,
      roles,
      authSource: 'oidc',
    }

    const session: SignedSession = {
      exp: Date.now() + appConfig.auth.sessionTtlMs,
      user,
    }

    return {
      status: 302,
      headers: {
        location: '/',
        'set-cookie': [
          cookie(sessionCookieName, signedValue(session), appConfig.auth.sessionTtlMs / 1000),
          clearState,
        ],
      },
    }
  } catch (err: any) {
    console.error('OIDC callback failed:', err?.message || err)
    return {
      status: 302,
      headers: {
        location: `/?error=${encodeURIComponent('登录验证失败：' + (err?.message || '未知错误'))}`,
        'set-cookie': clearState,
      },
    }
  }
}

export function createMockSession(username: string, displayName: string): { user: AuthUser; cookieHeader: string } {
  const cleanUsername = username.trim() || `user_${Math.floor(Math.random() * 9000 + 1000)}`
  const cleanDisplayName = displayName.trim() || cleanUsername
  const roles: string[] = []
  if (isUserAdmin(cleanUsername)) {
    roles.push('admin')
  }

  const user: AuthUser = {
    id: `mock_${cleanUsername}`,
    username: cleanUsername,
    displayName: cleanDisplayName,
    roles,
    authSource: 'mock',
  }

  const session: SignedSession = {
    exp: Date.now() + appConfig.auth.sessionTtlMs,
    user,
  }

  const cookieHeader = cookie(sessionCookieName, signedValue(session), appConfig.auth.sessionTtlMs / 1000)
  return { user, cookieHeader }
}

export function logout(): AuthRouteResponse {
  return {
    status: 302,
    headers: {
      location: '/',
      'set-cookie': [clearCookie(sessionCookieName), clearCookie(oidcStateCookieName, authPrefix)],
    },
  }
}
