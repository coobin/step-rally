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
  loginByName: (name: string, department?: string) =>
    request<{ success: boolean; message: string; user: import('./types.ts').AuthUser }>('/auth/login-by-name', {
      method: 'POST',
      body: JSON.stringify({ name, department }),
    }),
  adminLogin: (password: string) =>
    request<{ success: boolean; message: string; user: import('./types.ts').AuthUser }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ password }),
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
  importRoster: (base64: string) =>
    request<{ success: boolean; message: string; count: number; duplicates: number }>('/admin/roster/import', {
      method: 'POST',
      body: JSON.stringify({ base64 }),
    }),
  getRosterList: () =>
    request<{ roster: import('./types.ts').RosterUser[] }>('/admin/roster/list'),
  addRosterUser: (data: { name: string; department?: string; phone?: string; note?: string; isAdmin?: boolean }) =>
    request<{ success: boolean; message: string; user?: import('./types.ts').RosterUser }>('/admin/roster/add', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteRosterUser: (idOrName: string) =>
    request<{ success: boolean; message: string }>('/admin/roster/delete', {
      method: 'POST',
      body: JSON.stringify({ id: idOrName }),
    }),
  getRosterTemplateUrl: () => `${API_BASE}/admin/roster/template`,
  addTeam: (data: { name: string; slogan?: string; description?: string; icon?: string; maxMembers?: number }) =>
    request<{ success: boolean; message: string; team?: any }>('/admin/teams/add', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteTeam: (teamId: number) =>
    request<{ success: boolean; message: string }>('/admin/teams/delete', {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),
  updateActivityConfig: (config: {
    title?: string
    theme?: string
    targetStepsDaily?: number
    totalKmTarget?: number
    totalStepsTarget?: number
  }) =>
    request<{ success: boolean; message: string }>('/admin/activity/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  adminExcludeUser: (
    username: string,
    action: 'exclude' | 'restore',
    data?: { displayName?: string; department?: string; reason?: string },
  ) =>
    request<{ success: boolean; message: string }>('/admin/exclude-user', {
      method: 'POST',
      body: JSON.stringify({
        username,
        action,
        displayName: data?.displayName,
        department: data?.department,
        reason: data?.reason,
      }),
    }),
  getAdminSettings: () => request<import('./types.ts').AdminSettingsData>('/admin/settings'),
  updateAdminUser: (username: string, action: 'add' | 'remove') =>
    request<{ success: boolean; message: string; admins: import('./types.ts').AdminItem[] }>('/admin/settings/admins', {
      method: 'POST',
      body: JSON.stringify({ username, action }),
    }),
  updateTeamCapacity: (
    params:
      | number
      | {
          maxMembers?: number
          teamId?: number
          teamCapacities?: Record<string | number, number>
        },
    teamId?: number,
  ) => {
    const body =
      typeof params === 'number'
        ? { maxMembers: params, teamId }
        : params
    return request<{ success: boolean; message: string; maxPerTeam?: number; teams?: any[] }>(
      '/admin/settings/team-capacity',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    )
  },
  getExportUrl: () => `${API_BASE}/export/excel`,
  getOidcLoginUrl: () => `${API_BASE}/auth/oidc/login`,
  getLogoutUrl: () => `${API_BASE}/auth/logout`,
}
