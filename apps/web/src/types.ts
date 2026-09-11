export interface AuthUser {
  id: string
  username: string
  displayName: string
  isAdmin: boolean
  authSource: 'oidc' | 'mock'
}

export interface MyTeamInfo {
  id: number
  name: string
  slogan: string
  myVote: string | null
  joinedAt: string
}

export interface MeResponse {
  authenticated: boolean
  user: AuthUser | null
  myTeam: MyTeamInfo | null
  authConfig: {
    mode: 'oidc' | 'mock' | 'all'
    hasOidc: boolean
  }
}

export interface TeamMember {
  username: string
  displayName: string
  joinedAt: string
  mobile?: string
  note?: string
}

export interface TeamVoteCount {
  candidateUsername: string
  candidateName: string
  count: number
  voters: string[]
}

export interface TeamItem {
  id: number
  name: string
  slogan: string
  description?: string
  icon?: string
  memberCount: number
  maxMembers: number
  targetMembers: number
  isFull: boolean
  members: TeamMember[]
  votes: Record<string, string>
  voteRanking: TeamVoteCount[]
  currentLeader: TeamMember | null
  totalVotes: number
}

export interface LdapEmployee {
  username: string
  displayName: string
  department: string
  title: string
  email?: string
}

export interface ExcludedUser {
  username: string
  displayName: string
  department?: string
  reason?: string
  excludedAt: string
  excludedBy?: string
}

export interface SnapshotData {
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
  teams: TeamItem[]
  departments: string[]
  unassignedEmployees: LdapEmployee[]
  excludedEmployees?: ExcludedUser[]
  statistics: {
    totalCompanyEmployees: number
    excludedCount?: number
    eligibleEmployeesCount?: number
    totalMembers: number
    unassignedCount: number
    registrationRate: number
    maxCapacity: number
    targetCapacity: number
    teamCount: number
    fullTeamsCount: number
  }
  updatedAt: string
}
