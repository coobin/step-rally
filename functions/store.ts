import * as XLSX from 'xlsx'
import type { Env, RallyState, Team, TeamMember, TeamVoteCount, ExcludedUser, RosterUser } from './types'

const DEFAULT_TEAMS_INIT: Array<Pick<Team, 'id' | 'name' | 'slogan' | 'description' | 'icon'>> = [
  { id: 1, name: '雄鹰翱翔队', slogan: '大鹏一日同风起，扶摇直上九万里', description: '高瞻远瞩，锐意进取', icon: '🦅' },
  { id: 2, name: '雷霆先锋队', slogan: '雷厉风行，勇争第一', description: '迅猛如雷，无往不胜', icon: '⚡' },
  { id: 3, name: '乘风破浪队', slogan: '长风破浪会有时，直挂云帆济沧海', description: '披荆斩棘，奋勇争先', icon: '⛵' },
  { id: 4, name: '烈火战狼队', slogan: '烈火淬炼，众志成城', description: '战无不胜，铁血之师', icon: '🔥' },
  { id: 5, name: '巅峰登顶队', slogan: '无限风光在险峰', description: '勇攀高峰，无惧险阻', icon: '🏔️' },
  { id: 6, name: '星辰大海队', slogan: '心怀璀璨，追逐星辰', description: '向光而行，奔赴远方', icon: '⭐' },
  { id: 7, name: '荣耀王者队', slogan: '聚力同心，再铸辉煌', description: '精诚团结，荣耀加冕', icon: '👑' },
  { id: 8, name: '猛虎腾跃队', slogan: '龙腾虎跃，势不可挡', description: '气势如虹，敢为人先', icon: '🐅' },
]

function createDefaultState(): RallyState {
  return {
    title: '荣耀征程 · 大型团队竞技与拉练争霸赛',
    theme: '凝心聚力，勇攀高峰，向胜利全速进发！',
    activityRules: {
      totalTeams: 8,
      targetPerTeam: 10,
      maxPerTeam: 15,
      targetStepsDaily: 8000,
      totalStepsTarget: 50000,
      totalKmTarget: 35,
    },
    teams: DEFAULT_TEAMS_INIT.map((item) => ({
      id: item.id,
      name: item.name,
      slogan: item.slogan,
      description: item.description,
      icon: item.icon,
      maxMembers: 15,
      targetMembers: 10,
      members: [],
      votes: {},
    })),
    roster: [],
    excludedUsers: [],
    adminUsernames: ['admin'],
    updatedAt: new Date().toISOString(),
  }
}

// 内存单例兜底（针对没有绑定 KV 的情况）
const globalStateSymbol = Symbol.for('RALLY_PAGES_MEMORY_STATE')
const globalScope = globalThis as any
if (!globalScope[globalStateSymbol]) {
  globalScope[globalStateSymbol] = createDefaultState()
}

export class RallyEdgeStore {
  private env: Env
  private state!: RallyState

  constructor(env: Env) {
    this.env = env
  }

  public async init(): Promise<void> {
    if (this.env.RALLY_KV) {
      try {
        const stored = await this.env.RALLY_KV.get<RallyState>('rally_state', 'json')
        if (stored && Array.isArray(stored.teams) && stored.teams.length > 0) {
          stored.roster = Array.isArray(stored.roster) ? stored.roster : []
          stored.excludedUsers = Array.isArray(stored.excludedUsers) ? stored.excludedUsers : []
          stored.adminUsernames = Array.isArray(stored.adminUsernames) ? stored.adminUsernames : ['admin']
          this.state = stored
          return
        }
      } catch (err) {
        console.warn('读取 KV 失败，使用默认状态:', err)
      }
    }
    this.state = globalScope[globalStateSymbol] || createDefaultState()
  }

  private async saveState(): Promise<void> {
    this.state.updatedAt = new Date().toISOString()
    globalScope[globalStateSymbol] = this.state
    if (this.env.RALLY_KV) {
      try {
        await this.env.RALLY_KV.put('rally_state', JSON.stringify(this.state))
      } catch (err) {
        console.error('写入 KV 异常:', err)
      }
    }
  }

  public getTeamVoteStats(team: Team): {
    voteRanking: TeamVoteCount[]
    currentElectedLeader: TeamMember | null
    totalVotes: number
  } {
    const counts: Record<string, { count: number; voters: string[] }> = {}
    const memberMap = new Map(team.members.map((m) => [m.username, m]))

    for (const [voter, candidate] of Object.entries(team.votes || {})) {
      if (memberMap.has(voter) && memberMap.has(candidate)) {
        if (!counts[candidate]) {
          counts[candidate] = { count: 0, voters: [] }
        }
        counts[candidate].count += 1
        const voterMember = memberMap.get(voter)
        counts[candidate].voters.push(voterMember?.displayName || voter)
      }
    }

    const voteRanking: TeamVoteCount[] = Object.entries(counts)
      .map(([candUser, data]) => ({
        candidateUsername: candUser,
        candidateName: memberMap.get(candUser)?.displayName || candUser,
        count: data.count,
        voters: data.voters,
      }))
      .sort((a, b) => b.count - a.count)

    let currentElectedLeader: TeamMember | null = null
    if (team.lockedLeaderUsername && memberMap.has(team.lockedLeaderUsername)) {
      currentElectedLeader = memberMap.get(team.lockedLeaderUsername)!
    } else if (voteRanking.length > 0 && voteRanking[0].count > 0) {
      currentElectedLeader = memberMap.get(voteRanking[0].candidateUsername) || null
    }

    const totalVotes = Object.values(counts).reduce((sum, item) => sum + item.count, 0)
    return { voteRanking, currentElectedLeader, totalVotes }
  }

  public getTeamsSummary() {
    return (this.state.teams || []).map((team) => {
      const stats = this.getTeamVoteStats(team)
      const leaderUsername = stats.currentElectedLeader?.username
      const sortedMembers = leaderUsername
        ? [
            ...team.members.filter((m) => m.username === leaderUsername),
            ...team.members.filter((m) => m.username !== leaderUsername),
          ]
        : team.members

      return {
        id: team.id,
        name: team.name,
        slogan: team.slogan,
        description: team.description,
        icon: team.icon,
        memberCount: team.members.length,
        maxMembers: team.maxMembers,
        targetMembers: team.targetMembers,
        isFull: team.members.length >= team.maxMembers,
        members: sortedMembers,
        votes: team.votes || {},
        voteRanking: stats.voteRanking,
        currentLeader: stats.currentElectedLeader,
        totalVotes: stats.totalVotes,
      }
    })
  }

  public async getSnapshot(isAdmin = false) {
    const roster = this.state.roster || []
    const allEmployees = roster.map((r) => ({
      username: r.name,
      displayName: r.name,
      department: r.department || '未分配部门',
      title: r.note || '队员',
      email: r.phone || '',
    }))

    const teams = this.getTeamsSummary()
    const registeredUsernames = new Set<string>()
    for (const t of teams) {
      for (const m of t.members) {
        registeredUsernames.add(m.username.toLowerCase())
        registeredUsernames.add(m.displayName.toLowerCase())
      }
    }

    const excludedUsers = this.state.excludedUsers || []
    const excludedSet = new Set(excludedUsers.map((u) => u.username.toLowerCase()))

    const unassignedEmployees = allEmployees.filter(
      (e) =>
        !registeredUsernames.has(e.username.toLowerCase()) &&
        !registeredUsernames.has(e.displayName.toLowerCase()) &&
        !excludedSet.has(e.username.toLowerCase()) &&
        !excludedSet.has(e.displayName.toLowerCase()),
    )

    const departments = [...new Set(allEmployees.map((e) => e.department).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh-CN')
    )

    const totalMembers = teams.reduce((acc, t) => acc + t.memberCount, 0)
    const maxCapacity = teams.reduce((acc, t) => acc + t.maxMembers, 0)
    const targetCapacity = teams.reduce((acc, t) => acc + t.targetMembers, 0)
    const totalCompanyEmployees = allEmployees.length > 0 ? allEmployees.length : Math.max(totalMembers, maxCapacity > 0 ? maxCapacity : 100)
    const excludedCount = excludedUsers.length
    const eligibleEmployeesCount = Math.max(0, totalCompanyEmployees - excludedCount)
    const registrationRate = eligibleEmployeesCount > 0 ? Math.round((totalMembers / eligibleEmployeesCount) * 100) : 0

    return {
      title: this.state.title,
      theme: this.state.theme,
      activityRules: this.state.activityRules,
      teams,
      departments,
      unassignedEmployees,
      excludedEmployees: isAdmin ? excludedUsers : [],
      statistics: {
        totalCompanyEmployees,
        ...(isAdmin ? { excludedCount } : {}),
        eligibleEmployeesCount,
        totalMembers,
        unassignedCount: unassignedEmployees.length,
        registrationRate,
        maxCapacity,
        targetCapacity,
        teamCount: teams.length,
        fullTeamsCount: teams.filter((t) => t.isFull).length,
      },
      updatedAt: this.state.updatedAt,
    }
  }

  public findUserTeam(username: string): { team: Team; member: TeamMember } | null {
    const clean = username.trim().toLowerCase()
    for (const team of this.state.teams) {
      const member = team.members.find(
        (m) => m.username.toLowerCase() === clean || m.displayName.toLowerCase() === clean
      )
      if (member) return { team, member }
    }
    return null
  }

  public async joinTeam(
    teamId: number,
    user: { username: string; displayName: string; department?: string },
    options?: { mobile?: string; note?: string; switchTeam?: boolean }
  ): Promise<{ success: boolean; message: string; team?: Team }> {
    const existing = this.findUserTeam(user.username)
    if (existing) {
      if (existing.team.id === teamId) {
        return { success: false, message: '您已经是该战队成员，无需重复加入' }
      }
      if (options?.switchTeam) {
        await this.leaveTeam(user.username)
      } else {
        return {
          success: false,
          message: `您已加入了【${existing.team.name}】，若想更换队伍，请先退出原队伍`,
        }
      }
    }

    const team = this.state.teams.find((t) => t.id === teamId)
    if (!team) return { success: false, message: '指定的战队不存在' }

    if (team.members.length >= team.maxMembers) {
      return { success: false, message: `【${team.name}】已达到上限人数（${team.maxMembers}人），请选择其他战队` }
    }

    const newMember: TeamMember = {
      username: user.username,
      displayName: user.displayName || user.username,
      department: user.department,
      joinedAt: new Date().toISOString(),
      mobile: options?.mobile?.trim() || undefined,
      note: options?.note?.trim() || undefined,
    }

    team.members.push(newMember)
    await this.saveState()
    return { success: true, message: `恭喜成功加入【${team.name}】！`, team }
  }

  public async leaveTeam(username: string): Promise<{ success: boolean; message: string; leftTeamId?: number }> {
    const existing = this.findUserTeam(username)
    if (!existing) {
      return { success: false, message: '您当前尚未加入任何战队' }
    }

    const { team } = existing
    const uClean = username.trim().toLowerCase()
    team.members = team.members.filter((m) => m.username.toLowerCase() !== uClean && m.displayName.toLowerCase() !== uClean)

    if (team.votes) {
      delete team.votes[username]
      for (const [v, c] of Object.entries(team.votes)) {
        if (c.toLowerCase() === uClean) delete team.votes[v]
      }
    }

    if (team.lockedLeaderUsername?.toLowerCase() === uClean) {
      team.lockedLeaderUsername = undefined
    }

    await this.saveState()
    return { success: true, message: `已成功退出【${team.name}】`, leftTeamId: team.id }
  }

  public async voteLeader(voterUsername: string, candidateUsername: string): Promise<{ success: boolean; message: string }> {
    const existing = this.findUserTeam(voterUsername)
    if (!existing) return { success: false, message: '请先加入战队后再参与队长推举' }

    const { team } = existing
    const cand = team.members.find((m) => m.username === candidateUsername || m.displayName === candidateUsername)
    if (!cand) return { success: false, message: '被推举的队长候选人必须是本队正式成员' }

    team.votes = team.votes || {}
    team.votes[voterUsername] = cand.username
    await this.saveState()
    return { success: true, message: `您已成功将队长选票投给【${cand.displayName}】` }
  }

  public async updateTeam(
    teamId: number,
    data: { name?: string; slogan?: string },
    user: { username: string; isAdmin: boolean }
  ): Promise<{ success: boolean; message: string }> {
    const team = this.state.teams.find((t) => t.id === teamId)
    if (!team) return { success: false, message: '战队不存在' }

    const stats = this.getTeamVoteStats(team)
    const isLeader = stats.currentElectedLeader?.username.toLowerCase() === user.username.toLowerCase()
    if (!isLeader && !user.isAdmin) {
      return { success: false, message: '只有本队队长或管理员可以修改战队信息' }
    }

    if (data.name?.trim()) team.name = data.name.trim().slice(0, 30)
    if (data.slogan?.trim()) team.slogan = data.slogan.trim().slice(0, 60)

    await this.saveState()
    return { success: true, message: '战队信息已更新' }
  }

  public async resetTeam(teamId: number): Promise<{ success: boolean; message: string }> {
    const team = this.state.teams.find((t) => t.id === teamId)
    if (!team) return { success: false, message: '战队不存在' }

    team.members = []
    team.votes = {}
    team.lockedLeaderUsername = undefined
    await this.saveState()
    return { success: true, message: `战队【${team.name}】已成功清空` }
  }

  public async addTeam(data: { name: string; slogan?: string; description?: string; icon?: string; maxMembers?: number }): Promise<{ success: boolean; message: string; team?: Team }> {
    const name = data.name?.trim()
    if (!name) return { success: false, message: '战队名称不能为空' }
    if (this.state.teams.some((t) => t.name === name)) {
      return { success: false, message: `战队【${name}】已存在` }
    }

    const nextId = this.state.teams.length > 0 ? Math.max(...this.state.teams.map((t) => t.id)) + 1 : 1
    const newTeam: Team = {
      id: nextId,
      name,
      slogan: data.slogan?.trim() || '团结一心，勇往直前',
      description: data.description?.trim() || '',
      icon: data.icon?.trim() || '🚩',
      maxMembers: Number(data.maxMembers) || this.state.activityRules.maxPerTeam || 15,
      targetMembers: this.state.activityRules.targetPerTeam || 10,
      members: [],
      votes: {},
    }

    this.state.teams.push(newTeam)
    this.state.activityRules.totalTeams = this.state.teams.length
    await this.saveState()
    return { success: true, message: `已成功创建战队【${name}】`, team: newTeam }
  }

  public async deleteTeam(teamId: number): Promise<{ success: boolean; message: string }> {
    const idx = this.state.teams.findIndex((t) => t.id === teamId)
    if (idx === -1) return { success: false, message: '战队不存在' }
    const removed = this.state.teams.splice(idx, 1)[0]
    this.state.activityRules.totalTeams = this.state.teams.length
    await this.saveState()
    return { success: true, message: `已成功解散战队【${removed.name}】` }
  }

  public async excludeUser(user: { username: string; displayName?: string; department?: string }, reason?: string, operatorUsername?: string): Promise<{ success: boolean; message: string; excludedUser: ExcludedUser }> {
    const username = user.username.trim()
    if (!username) return { success: false, message: '姓名不能为空', excludedUser: null as any }

    this.state.excludedUsers = this.state.excludedUsers || []
    await this.leaveTeam(username)

    const index = this.state.excludedUsers.findIndex((u) => u.username.toLowerCase() === username.toLowerCase())
    const record: ExcludedUser = {
      username,
      displayName: user.displayName?.trim() || username,
      department: user.department?.trim() || undefined,
      reason: reason?.trim() || '免参与',
      excludedAt: new Date().toISOString(),
      excludedBy: operatorUsername || '系统管理员',
    }

    if (index >= 0) {
      this.state.excludedUsers[index] = record
    } else {
      this.state.excludedUsers.push(record)
    }

    await this.saveState()
    return { success: true, message: `已将【${record.displayName}】设为免报名人员`, excludedUser: record }
  }

  public async restoreUser(username: string): Promise<{ success: boolean; message: string }> {
    const uname = username.trim().toLowerCase()
    if (!this.state.excludedUsers || this.state.excludedUsers.length === 0) {
      return { success: false, message: '该员工未在免报名单中' }
    }
    const idx = this.state.excludedUsers.findIndex((u) => u.username.toLowerCase() === uname)
    if (idx === -1) return { success: false, message: '该员工未在免报名单中' }

    const removed = this.state.excludedUsers.splice(idx, 1)[0]
    await this.saveState()
    return { success: true, message: `已恢复【${removed.displayName}】的报名资格` }
  }

  public getAdminUsernames(): string[] {
    const list = this.state.adminUsernames || ['admin']
    return [...new Set(list.map((u) => u.toLowerCase()))]
  }

  public isAdmin(username: string): boolean {
    if (!username) return false
    return this.getAdminUsernames().includes(username.trim().toLowerCase())
  }

  public getAdminSettingsDetails() {
    const allAdmins = this.getAdminUsernames()
    const admins = allAdmins.map((u) => ({
      username: u,
      isBuiltin: u === 'admin',
    }))
    return {
      admins,
      excludedUsers: this.state.excludedUsers || [],
      activityRules: this.state.activityRules,
      teams: this.state.teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: t.members.length,
        maxMembers: t.maxMembers,
      })),
      updatedAt: this.state.updatedAt,
    }
  }

  public async addAdmin(username: string): Promise<{ success: boolean; message: string }> {
    const u = username.trim().toLowerCase()
    if (!u) return { success: false, message: '请输入合法管理员账号' }
    this.state.adminUsernames = this.state.adminUsernames || ['admin']
    if (this.isAdmin(u)) return { success: false, message: `【${username}】已经是管理员` }
    this.state.adminUsernames.push(u)
    await this.saveState()
    return { success: true, message: `已添加【${username}】为管理员` }
  }

  public async removeAdmin(username: string, operatorUsername: string): Promise<{ success: boolean; message: string }> {
    const u = username.trim().toLowerCase()
    if (u === operatorUsername.trim().toLowerCase()) return { success: false, message: '不能移除自身的管理员权限' }
    if (u === 'admin') return { success: false, message: '内置管理员无法移除' }

    this.state.adminUsernames = (this.state.adminUsernames || []).filter((x) => x.toLowerCase() !== u)
    await this.saveState()
    return { success: true, message: `已移除【${username}】的管理员权限` }
  }

  public async updateTeamCapacity(options: any): Promise<{ success: boolean; message: string }> {
    const rosterCount = this.state.roster?.length || 0
    const totalCompanyEmployees = rosterCount > 0 ? rosterCount : 1000

    if (typeof options === 'object' && options.teamCapacities) {
      const capacities = options.teamCapacities
      let totalCapacity = 0
      const updates: Array<{ team: Team; limit: number }> = []

      for (const team of this.state.teams) {
        const rawLimit = capacities[team.id] !== undefined ? capacities[team.id] : team.maxMembers
        const limit = Math.floor(Number(rawLimit))
        if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
          return { success: false, message: `【${team.name}】的人数上限必须在 1 到 100 之间` }
        }
        if (team.members.length > limit) {
          return { success: false, message: `【${team.name}】当前已有 ${team.members.length} 人，上限不能低于已有成员数` }
        }
        totalCapacity += limit
        updates.push({ team, limit })
      }

      if (rosterCount > 0 && totalCapacity > totalCompanyEmployees) {
        return { success: false, message: `各队人数上限总和（${totalCapacity}人）不能超过总人数（${totalCompanyEmployees}人）` }
      }

      for (const item of updates) {
        item.team.maxMembers = item.limit
      }
      this.state.activityRules.maxPerTeam = Math.max(...this.state.teams.map((t) => t.maxMembers))
      await this.saveState()
      return { success: true, message: `各队人数上限已成功保存（合计 ${totalCapacity} 人）` }
    }

    return { success: false, message: '参数格式不正确' }
  }

  public async updateActivityConfig(config: { title?: string; theme?: string; targetStepsDaily?: number; totalKmTarget?: number }): Promise<{ success: boolean; message: string }> {
    if (config.title?.trim()) this.state.title = config.title.trim()
    if (config.theme?.trim()) this.state.theme = config.theme.trim()
    if (config.targetStepsDaily && Number(config.targetStepsDaily) > 0) {
      this.state.activityRules.targetStepsDaily = Number(config.targetStepsDaily)
    }
    if (config.totalKmTarget && Number(config.totalKmTarget) > 0) {
      this.state.activityRules.totalKmTarget = Number(config.totalKmTarget)
    }
    await this.saveState()
    return { success: true, message: '活动配置已更新' }
  }

  public getRoster(): RosterUser[] {
    return this.state.roster || []
  }

  public findRosterUserByName(name: string): RosterUser[] {
    const clean = name.trim().toLowerCase()
    if (!clean) return []
    return (this.state.roster || []).filter((u) => u.name.trim().toLowerCase() === clean)
  }

  public async importRosterFromExcel(data: Uint8Array | ArrayBuffer): Promise<{ success: boolean; message: string; count: number; duplicates: number }> {
    try {
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) return { success: false, message: 'Excel 中未发现工作表', count: 0, duplicates: 0 }

      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        return { success: false, message: '表格中无有效数据', count: 0, duplicates: 0 }
      }

      this.state.roster = this.state.roster || []
      let importedCount = 0
      let updatedCount = 0

      for (const row of rawRows) {
        let name = ''
        let department = ''
        let phone = ''
        let note = ''

        for (const [key, val] of Object.entries(row)) {
          const k = String(key).trim().toLowerCase()
          const v = String(val ?? '').trim()
          if (!v) continue
          if (k.includes('姓名') || k === '名字' || k === 'name' || k === '人员') {
            name = v
          } else if (k.includes('部门') || k.includes('单位') || k === 'department') {
            department = v
          } else if (k.includes('手机') || k.includes('电话') || k === 'phone' || k === 'mobile') {
            phone = v
          } else if (k.includes('备注') || k === 'note') {
            note = v
          }
        }

        if (!name) continue
        const existing = this.state.roster.find((u) => u.name.trim().toLowerCase() === name.toLowerCase())
        if (existing) {
          if (department) existing.department = department
          if (phone) existing.phone = phone
          if (note) existing.note = note
          updatedCount++
        } else {
          this.state.roster.push({
            id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            department: department || undefined,
            phone: phone || undefined,
            note: note || undefined,
            createdAt: new Date().toISOString(),
          })
          importedCount++
        }
      }

      await this.saveState()
      return {
        success: true,
        message: `导入成功！新增 ${importedCount} 人，更新 ${updatedCount} 人`,
        count: importedCount,
        duplicates: updatedCount,
      }
    } catch (err: any) {
      return { success: false, message: `解析 Excel 失败: ${err?.message || '格式错误'}`, count: 0, duplicates: 0 }
    }
  }

  public async addRosterUser(data: { name: string; department?: string; phone?: string; note?: string; isAdmin?: boolean }): Promise<{ success: boolean; message: string; user?: RosterUser }> {
    const name = data.name?.trim()
    if (!name) return { success: false, message: '姓名不能为空' }

    this.state.roster = this.state.roster || []
    const existing = this.state.roster.find((u) => u.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) {
      existing.department = data.department?.trim() || existing.department
      existing.phone = data.phone?.trim() || existing.phone
      existing.note = data.note?.trim() || existing.note
      await this.saveState()
      return { success: true, message: `【${name}】已在名单中，已更新信息`, user: existing }
    }

    const newUser: RosterUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      department: data.department?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      note: data.note?.trim() || undefined,
      isAdmin: data.isAdmin,
      createdAt: new Date().toISOString(),
    }

    this.state.roster.push(newUser)
    await this.saveState()
    return { success: true, message: `已录入【${name}】`, user: newUser }
  }

  public async removeRosterUser(idOrName: string): Promise<{ success: boolean; message: string }> {
    if (!this.state.roster) return { success: false, message: '名单为空' }
    const target = idOrName.trim().toLowerCase()
    const idx = this.state.roster.findIndex((u) => u.id.toLowerCase() === target || u.name.toLowerCase() === target)
    if (idx === -1) return { success: false, message: '未找到该人员' }

    const removed = this.state.roster.splice(idx, 1)[0]
    await this.leaveTeam(removed.name)
    await this.saveState()
    return { success: true, message: `已删除【${removed.name}】` }
  }
}
