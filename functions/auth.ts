import type { AuthUser } from './types'

const sessionCookieName = 'rally_session'
const DEFAULT_SECRET = 'step-rally-cf-pages-secret-2026!'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret || DEFAULT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function signString(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await getHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

async function verifyString(value: string, signatureBase64Url: string, secret: string): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const key = await getHmacKey(secret)
    const sigBytes = base64UrlToBytes(signatureBase64Url)
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(value))
  } catch {
    return false
  }
}

export async function createSignedValue<T extends object>(value: T, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const jsonStr = JSON.stringify(value)
  const payload = bytesToBase64Url(enc.encode(jsonStr))
  const sig = await signString(payload, secret)
  return `${payload}.${sig}`
}

export async function verifySignedValue<T extends object>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex <= 0) return null
  const payload = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)
  const valid = await verifyString(payload, signature, secret)
  if (!valid) return null

  try {
    const bytes = base64UrlToBytes(payload)
    const dec = new TextDecoder()
    const jsonStr = dec.decode(bytes)
    return JSON.parse(jsonStr) as T
  } catch {
    return null
  }
}

export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  const cookies: Record<string, string> = {}
  for (const item of cookieHeader.split(';')) {
    const sep = item.indexOf('=')
    if (sep > 0) {
      const name = item.slice(0, sep).trim()
      const rawVal = item.slice(sep + 1).trim()
      try {
        cookies[name] = decodeURIComponent(rawVal)
      } catch {
        cookies[name] = rawVal
      }
    }
  }
  return cookies
}

export async function createSessionCookie(user: AuthUser, secret: string, ttlSeconds = 7 * 24 * 3600): Promise<string> {
  const session = {
    exp: Date.now() + ttlSeconds * 1000,
    user,
  }
  const signed = await createSignedValue(session, secret)
  return `${sessionCookieName}=${encodeURIComponent(signed)}; Path=/; Max-Age=${ttlSeconds}; HttpOnly; SameSite=Lax; Secure`
}

export function clearSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`
}

export async function getCurrentUserFromCookie(cookieHeader: string | null | undefined, secret: string): Promise<AuthUser | null> {
  const cookies = parseCookies(cookieHeader)
  const sessionToken = cookies[sessionCookieName]
  if (!sessionToken) return null

  const session = await verifySignedValue<{ exp: number; user: AuthUser }>(sessionToken, secret)
  if (!session || !session.user || typeof session.exp !== 'number' || session.exp <= Date.now()) {
    return null
  }
  return session.user
}
