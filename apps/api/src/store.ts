import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { appConfig } from './config.ts'

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

export interface Team {
  id: number
  name: string
  slogan: string
  description?: string
  icon?: string
  maxMembers: number
  targetMembers: number
  members: TeamMember[]
  // voterUsername -> candidateUsername
  votes: Record<string, string>
  // 最终确定的队长（若尚未手工确定，则根据投票实时最高票计算）
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
  excludedUsers?: ExcludedUser[]
  adminUsernames?: string[]
  updatedAt: string
}

const DEFAULT_TEAMS_INIT: Array<Pick<Team, 'id' | 'name' | 'slogan' | 'description' | 'icon'>> = [
  { id: 1, name: '井冈星火队', slogan: '星星之火，可以燎原', description: '新四军精神，点燃奋进之火', icon: '🔥' },
  { id: 2, name: '长征先锋队', slogan: '万水千山只等闲', description: '突破重重险阻，勇往直前', icon: '🚩' },
  { id: 3, name: '延安奋进队', slogan: '自力更生，艰苦奋斗', description: '宝塔山下，传承红色基因', icon: '🏔️' },
  { id: 4, name: '太行铁军队', slogan: '巍巍太行，勇夺先锋', description: '百团大战英雄气，众志成城', icon: '🛡️' },
  { id: 5, name: '红色渡江队', slogan: '百万雄师，奋勇争先', description: '渡江战役，乘风破浪', icon: '⛵' },
  { id: 6, name: '西柏坡号队', slogan: '赶考路上，永葆初心', description: '进京赶考，砥砺前行', icon: '⭐' },
  { id: 7, name: '香山启航队', slogan: '胸怀壮志，走向未来', description: '革命圣地，绘就宏伟蓝图', icon: '🌅' },
  { id: 8, name: '淮海决胜队', slogan: '团结一致，勇夺胜利', description: '人民的胜利，齐心协力', icon: '🏆' },
  { id: 9, name: '复兴领航队', slogan: '不忘初心，牢记使命', description: '天安门广场，昂首向明天', icon: '🚀' },
  { id: 10, name: '善行天下队', slogan: '一步一善，筑梦乡村', description: '用脚步传递温暖，让善意抵达远方', icon: '❤️' },
]

export class RallyStore {
  private filePath: string
  private state: RallyState

  constructor() {
    this.filePath = resolve(process.cwd(), appConfig.dataFile)
    this.state = this.loadOrCreate()
  }

  private loadOrCreate(): RallyState {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw) as RallyState
        if (parsed && Array.isArray(parsed.teams) && parsed.teams.length === 10) {
          if (!Array.isArray(parsed.excludedUsers)) {
            parsed.excludedUsers = []
          }
          if (!Array.isArray(parsed.adminUsernames)) {
            parsed.adminUsernames = []
          }
          return parsed
        }
      }
    } catch (err) {
      console.warn('读取现有存储文件异常，将初始化新数据:', err)
    }

    const defaultState: RallyState = {
      title: '一步一善 · 重走经典红色路',
      theme: '让行走更有意义，为乡村孩子送去优质课堂',
      activityRules: {
        totalTeams: 10,
        targetPerTeam: 14,
        maxPerTeam: 15,
        targetStepsDaily: 6000,
        totalStepsTarget: 42000,
        totalKmTarget: 29.4,
      },
      teams: DEFAULT_TEAMS_INIT.map((item) => ({
        id: item.id,
        name: item.name,
        slogan: item.slogan,
        description: item.description,
        icon: item.icon,
        maxMembers: 15,
        targetMembers: 14,
        members: [],
        votes: {},
      })),
      excludedUsers: [],
      adminUsernames: [],
      updatedAt: new Date().toISOString(),
    }

    this.saveState(defaultState)
    return defaultState
  }

  private saveState(stateToSave: RallyState = this.state): void {
    stateToSave.updatedAt = new Date().toISOString()
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const tempFile = `${this.filePath}.tmp.${Date.now()}`
    writeFileSync(tempFile, JSON.stringify(stateToSave, null, 2), 'utf-8')
    renameSync(tempFile, this.filePath)
  }

  // 计算队伍推举得票统计
  public getTeamVoteStats(team: Team): {
    voteRanking: TeamVoteCount[]
    currentElectedLeader: TeamMember | null
    totalVotes: number
  } {
    const counts: Record<string, { count: number; voters: string[] }> = {}
    const memberMap = new Map(team.members.map((m) => [m.username, m]))

    // 统计每位候选人的票数
    for (const [voter, candidate] of Object.entries(team.votes)) {
      // 只有候选人和投票者依然在队内，选票才生效
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

    // 如果管理员或小队手工锁定了队长，且该队长仍在队伍中
    if (team.lockedLeaderUsername && memberMap.has(team.lockedLeaderUsername)) {
      currentElectedLeader = memberMap.get(team.lockedLeaderUsername)!
    } else if (voteRanking.length > 0 && voteRanking[0].count > 0) {
      // 自动取最高得票者为当前推选队长
      currentElectedLeader = memberMap.get(voteRanking[0].candidateUsername) || null
    }

    const totalVotes = Object.values(counts).reduce((sum, item) => sum + item.count, 0)

    return {
      voteRanking,
      currentElectedLeader,
      totalVotes,
    }
  }

  // 获取对外展示的队伍列表
  public getTeamsSummary() {
    return this.state.teams.map((team) => {
      const stats = this.getTeamVoteStats(team)
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
        members: team.members,
        votes: team.votes,
        voteRanking: stats.voteRanking,
        currentLeader: stats.currentElectedLeader,
        totalVotes: stats.totalVotes,
      }
    })
  }

  // 获取当前系统所有报名情况及状态（结合 LDAP 全体在职员工）
  public async getSnapshot(isAdmin = false) {
    const teams = this.getTeamsSummary()
    const registeredUsernames = new Set<string>()
    for (const t of teams) {
      for (const m of t.members) {
        registeredUsernames.add(m.username.toLowerCase())
      }
    }

    const excludedUsers = this.state.excludedUsers || []
    const excludedUsernamesSet = new Set(excludedUsers.map((u) => u.username.toLowerCase()))

    let allEmployees: import('./ldap.ts').LdapEmployee[] = []
    try {
      allEmployees = await (await import('./ldap.ts')).fetchLdapEmployees()
    } catch (e) {
      console.warn('获取 LDAP 员工失败:', e)
    }

    // 结合 LDAP 员工信息丰富免报名名单的部门和姓名
    const employeeMap = new Map(allEmployees.map((e) => [e.username.toLowerCase(), e]))
    const enrichedExcludedEmployees: ExcludedUser[] = excludedUsers.map((u) => {
      const emp = employeeMap.get(u.username.toLowerCase())
      return {
        ...u,
        displayName: emp?.displayName || u.displayName,
        department: emp?.department || u.department || '未分配部门',
      }
    })

    // 计算未报名的员工（排除已在队伍中 + 排除已设为免报名的员工）
    const unassignedEmployees = allEmployees.filter(
      (e) =>
        !registeredUsernames.has(e.username.toLowerCase()) &&
        !excludedUsernamesSet.has(e.username.toLowerCase()),
    )

    const departments = [
      ...new Set(allEmployees.map((e) => e.department).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'zh-CN'))

    const totalMembers = teams.reduce((acc, t) => acc + t.memberCount, 0)
    const totalCompanyEmployees = allEmployees.length > 0 ? allEmployees.length : 142
    const excludedCount = enrichedExcludedEmployees.length
    const eligibleEmployeesCount = Math.max(0, totalCompanyEmployees - excludedCount)
    const maxCapacity = teams.reduce((acc, t) => acc + t.maxMembers, 0)
    const targetCapacity = teams.reduce((acc, t) => acc + t.targetMembers, 0)
    const registrationRate =
      eligibleEmployeesCount > 0 ? Math.round((totalMembers / eligibleEmployeesCount) * 100) : 0

    return {
      title: this.state.title,
      theme: this.state.theme,
      activityRules: this.state.activityRules,
      teams,
      departments,
      unassignedEmployees,
      // 仅管理员可见免报名人员明细与免报统计数
      excludedEmployees: isAdmin ? enrichedExcludedEmployees : [],
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

  // 查找某个用户所在的队伍
  public findUserTeam(username: string): { team: Team; member: TeamMember } | null {
    for (const team of this.state.teams) {
      const member = team.members.find((m) => m.username === username)
      if (member) {
        return { team, member }
      }
    }
    return null
  }

  // 用户加入队伍
  public joinTeam(
    teamId: number,
    user: { username: string; displayName: string },
    options?: { mobile?: string; note?: string; switchTeam?: boolean },
  ): { success: boolean; message: string; team?: Team } {
    const existing = this.findUserTeam(user.username)
    if (existing) {
      if (existing.team.id === teamId) {
        return { success: false, message: '您已经是该队伍成员，无需重复加入' }
      }
      if (options?.switchTeam) {
        this.leaveTeam(user.username)
      } else {
        return {
          success: false,
          message: `您已加入了【${existing.team.name}】，若想更换队伍，请先退出原队伍`,
        }
      }
    }

    const team = this.state.teams.find((t) => t.id === teamId)
    if (!team) {
      return { success: false, message: '指定的队伍不存在' }
    }

    if (team.members.length >= team.maxMembers) {
      return {
        success: false,
        message: `【${team.name}】已达到上限人数（${team.maxMembers}人），请选择其他队伍加入`,
      }
    }

    const newMember: TeamMember = {
      username: user.username,
      displayName: user.displayName || user.username,
      joinedAt: new Date().toISOString(),
      mobile: options?.mobile?.trim() || undefined,
      note: options?.note?.trim() || undefined,
    }

    team.members.push(newMember)
    this.saveState()
    return { success: true, message: `恭喜成功加入【${team.name}】！`, team }
  }

  // 用户退出队伍
  public leaveTeam(username: string): { success: boolean; message: string; leftTeamId?: number } {
    const existing = this.findUserTeam(username)
    if (!existing) {
      return { success: false, message: '您当前尚未加入任何队伍' }
    }

    const { team } = existing
    // 移除成员
    team.members = team.members.filter((m) => m.username !== username)

    // 清理该用户在队内投出的票
    delete team.votes[username]

    // 清理其他成员投给该退出用户的票
    for (const [voter, candidate] of Object.entries(team.votes)) {
      if (candidate === username) {
        delete team.votes[voter]
      }
    }

    // 如果该用户是手动指定的队长，重置手动指定
    if (team.lockedLeaderUsername === username) {
      team.lockedLeaderUsername = undefined
    }

    this.saveState()
    return {
      success: true,
      message: `已成功退出【${team.name}】`,
      leftTeamId: team.id,
    }
  }

  // 队内推选队长投票
  public voteLeader(
    voterUsername: string,
    candidateUsername: string,
  ): { success: boolean; message: string } {
    const existing = this.findUserTeam(voterUsername)
    if (!existing) {
      return { success: false, message: '请先加入队伍后再参与队长推举' }
    }

    const { team } = existing
    const candidateMember = team.members.find((m) => m.username === candidateUsername)
    if (!candidateMember) {
      return { success: false, message: '被推举的队长候选人必须是本队正式成员' }
    }

    team.votes[voterUsername] = candidateUsername
    this.saveState()

    return {
      success: true,
      message: `您已成功将队长选票投给【${candidateMember.displayName}】`,
    }
  }

  // 更新小队信息（队名、口号）
  public updateTeam(
    teamId: number,
    data: { name?: string; slogan?: string },
    user: { username: string; isAdmin: boolean },
  ): { success: boolean; message: string } {
    const team = this.state.teams.find((t) => t.id === teamId)
    if (!team) return { success: false, message: '队伍不存在' }

    // 权限检查：必须是队长或者管理员
    const stats = this.getTeamVoteStats(team)
    const isLeader = stats.currentElectedLeader?.username === user.username

    if (!isLeader && !user.isAdmin) {
      return { success: false, message: '只有本队队长或系统管理员可以修改队名与口号' }
    }

    if (data.name && data.name.trim()) {
      team.name = data.name.trim().slice(0, 30)
    }
    if (data.slogan && data.slogan.trim()) {
      team.slogan = data.slogan.trim().slice(0, 60)
    }

    this.saveState()
    return { success: true, message: '队伍信息更新成功' }
  }

  // 重置队伍（管理员功能）
  public resetTeam(teamId: number): { success: boolean; message: string } {
    const team = this.state.teams.find((t) => t.id === teamId)
    if (!team) return { success: false, message: '队伍不存在' }

    team.members = []
    team.votes = {}
    team.lockedLeaderUsername = undefined
    this.saveState()
    return { success: true, message: `队伍【${team.name}】已成功重置清空` }
  }

  // 排除人员（设为免报名）
  public excludeUser(
    user: { username: string; displayName?: string; department?: string },
    reason?: string,
    operatorUsername?: string,
  ): { success: boolean; message: string; excludedUser: ExcludedUser } {
    const username = user.username.trim()
    if (!username) {
      return { success: false, message: '用户名不能为空', excludedUser: null as any }
    }

    if (!this.state.excludedUsers) {
      this.state.excludedUsers = []
    }

    // 如果该员工已经在某支队伍中，自动将其退出队伍
    const existingTeam = this.findUserTeam(username)
    if (existingTeam) {
      this.leaveTeam(username)
    }

    const index = this.state.excludedUsers.findIndex(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    )

    const displayName = user.displayName?.trim() || (index >= 0 ? this.state.excludedUsers[index].displayName : username)
    const department = user.department?.trim() || (index >= 0 ? this.state.excludedUsers[index].department : '')

    const record: ExcludedUser = {
      username,
      displayName,
      department: department || undefined,
      reason: reason?.trim() || '免参与健步拉练',
      excludedAt: new Date().toISOString(),
      excludedBy: operatorUsername || undefined,
    }

    if (index >= 0) {
      this.state.excludedUsers[index] = record
    } else {
      this.state.excludedUsers.push(record)
    }

    this.saveState()
    return {
      success: true,
      message: `已成功将【${displayName}】设为免报名人员`,
      excludedUser: record,
    }
  }

  // 恢复人员报名资格
  public restoreUser(username: string): { success: boolean; message: string } {
    const uname = username.trim().toLowerCase()
    if (!this.state.excludedUsers || this.state.excludedUsers.length === 0) {
      return { success: false, message: '该员工未在免报名名单中' }
    }

    const index = this.state.excludedUsers.findIndex(
      (u) => u.username.toLowerCase() === uname,
    )
    if (index === -1) {
      return { success: false, message: '该员工未在免报名名单中' }
    }

    const removed = this.state.excludedUsers.splice(index, 1)[0]
    this.saveState()
    return {
      success: true,
      message: `已恢复【${removed.displayName}】的报名参战资格`,
    }
  }

  // 获取所有管理员账号（合并环境变量内置与动态添加）
  public getAdminUsernames(): string[] {
    const builtin = appConfig.auth.adminUsernames.map((u) => u.toLowerCase())
    const custom = (this.state.adminUsernames || []).map((u) => u.toLowerCase())
    return [...new Set([...builtin, ...custom])]
  }

  // 判断用户是否为管理员
  public isAdmin(username: string): boolean {
    if (!username) return false
    return this.getAdminUsernames().includes(username.trim().toLowerCase())
  }

  // 获取管理员设置详情
  public getAdminSettingsDetails() {
    const builtinSet = new Set(appConfig.auth.adminUsernames.map((u) => u.toLowerCase()))
    const allAdmins = this.getAdminUsernames()

    const admins = allAdmins.map((u) => ({
      username: u,
      isBuiltin: builtinSet.has(u),
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

  // 添加管理员
  public addAdmin(username: string): { success: boolean; message: string; admins: Array<{ username: string; isBuiltin: boolean }> } {
    const u = username.trim().toLowerCase()
    if (!u) {
      return { success: false, message: '请输入合法的员工工号或账号', admins: this.getAdminSettingsDetails().admins }
    }

    if (!this.state.adminUsernames) {
      this.state.adminUsernames = []
    }

    if (this.isAdmin(u)) {
      return { success: false, message: `【${username}】已经是系统管理员，无需重复添加`, admins: this.getAdminSettingsDetails().admins }
    }

    this.state.adminUsernames.push(u)
    this.saveState()

    return {
      success: true,
      message: `已成功将【${username}】添加为系统管理员`,
      admins: this.getAdminSettingsDetails().admins,
    }
  }

  // 移除管理员
  public removeAdmin(
    username: string,
    operatorUsername: string,
  ): { success: boolean; message: string; admins: Array<{ username: string; isBuiltin: boolean }> } {
    const u = username.trim().toLowerCase()
    if (u === operatorUsername.trim().toLowerCase()) {
      return { success: false, message: '不能移除当前正在操作的自身管理员权限', admins: this.getAdminSettingsDetails().admins }
    }

    const builtinSet = new Set(appConfig.auth.adminUsernames.map((x) => x.toLowerCase()))
    if (builtinSet.has(u)) {
      return {
        success: false,
        message: `【${username}】为系统底层配置文件中设定的默认管理员，无法在界面直接移除`,
        admins: this.getAdminSettingsDetails().admins,
      }
    }

    if (!this.state.adminUsernames || !this.state.adminUsernames.includes(u)) {
      return { success: false, message: '该账号不在管理员名单中', admins: this.getAdminSettingsDetails().admins }
    }

    this.state.adminUsernames = this.state.adminUsernames.filter((x) => x !== u)
    this.saveState()

    return {
      success: true,
      message: `已成功移除【${username}】的管理员权限`,
      admins: this.getAdminSettingsDetails().admins,
    }
  }
}

export const rallyStore = new RallyStore()
