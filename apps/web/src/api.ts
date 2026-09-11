import type { MeResponse, SnapshotData } from './types.ts'

const API_BASE = '/api/v1'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  })

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) {
        errorMsg = typeof data.error === 'string' ? data.error : data.error.message || errorMsg
      }
    } catch {}
    throw new Error(errorMsg)
  }

  return res.json()
}

export const api = {
  getMe: () => request<MeResponse>('/auth/me'),
  getTeams: () => request<SnapshotData>('/teams'),
  joinTeam: (teamId: number, note?: string, switchTeam?: boolean) =>
    request<{ success: boolean; message: string }>('/teams/join', {
      method: 'POST',
      body: JSON.stringify({ teamId, note, switchTeam }),
    }),
  leaveTeam: () =>
    request<{ success: boolean; message: string }>('/teams/leave', {
      method: 'POST',
    }),
  voteLeader: (candidateUsername: string) =>
    request<{ success: boolean; message: string }>('/teams/vote', {
      method: 'POST',
      body: JSON.stringify({ candidateUsername }),
    }),
  updateTeam: (teamId: number, name?: string, slogan?: string) =>
    request<{ success: boolean; message: string }>('/teams/update', {
      method: 'POST',
      body: JSON.stringify({ teamId, name, slogan }),
    }),
  mockLogin: (username: string, displayName: string) =>
    request<{ success: boolean; user: any }>('/auth/mock-login', {
      method: 'POST',
      body: JSON.stringify({ username, displayName }),
    }),
  resetTeam: (teamId: number) =>
    request<{ success: boolean; message: string }>('/admin/reset', {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),
  getExportUrl: () => `${API_BASE}/export/excel`,
  getOidcLoginUrl: () => `${API_BASE}/auth/oidc/login`,
  getLogoutUrl: () => `${API_BASE}/auth/logout`,
}
