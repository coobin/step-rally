export interface KVNamespace {
  get<T = string>(key: string, type?: 'text' | 'json' | 'arrayBuffer'): Promise<T | null>
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream): Promise<void>
  delete(key: string): Promise<void>
}

export interface Env {
  RALLY_KV?: KVNamespace
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
}

export interface TeamMember {
  username: string
  displayName: string
  joinedAt: string
  mobile?: string
  note?: string
  department?: string
}

export interface TeamVoteCount {
  candidateUsername: string
  candidateName: string
  count: number
  voters: string[]
}

export interface Team {
  id: number
  name: string
  slogan: string
  description?: string
  icon?: string
  maxMembers: number
  targetMembers: number
  members: TeamMember[]
  votes: Record<string, string>
  lockedLeaderUsername?: string
}

export interface ExcludedUser {
  username: string
  displayName: string
  department?: string
  reason?: string
  excludedAt: string
  excludedBy?: string
}

export interface RosterUser {
  id: string
  name: string
  department?: string
  phone?: string
  note?: string
  isAdmin?: boolean
  createdAt: string
}

export interface RallyState {
  title: string
  theme: string
  activityRules: {
    totalTeams: number
    targetPerTeam: number
    maxPerTeam: number
    targetStepsDaily: number
    totalStepsTarget: number
    totalKmTarget: number
  }
  teams: Team[]
  roster?: RosterUser[]
  excludedUsers?: ExcludedUser[]
  adminUsernames?: string[]
  updatedAt: string
}

export interface AuthUser {
  id: string
  username: string
  displayName: string
  department?: string
  roles: string[]
  authSource: 'roster' | 'admin' | 'oidc' | 'mock'
}
