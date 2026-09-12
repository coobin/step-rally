import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import * as XLSX from 'xlsx'
import { appConfig } from './config.ts'
import { getCachedEmployees } from './ldap.ts'

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

export class RallyStore {
  private filePath: string
  private state: RallyState

  constructor() {
    this.filePath = resolve(process.cwd(), appConfig.dataFile)
    this.state = this.loadOrCreate()
  }

  private loadOrCreate(): RallyState {
    // 候选文件依次尝试：主文件 -> .bak 备份 -> 历史快照目录最新文件
    const candidateFiles: string[] = [this.filePath, `${this.filePath}.bak`]
    const dir = dirname(this.filePath)
    const backupDir = join(dir, 'backups')
    if (existsSync(backupDir)) {
      try {
        const snapshots = readdirSync(backupDir)
          .filter((f) => f.startsWith('rally-') && f.endsWith('.json'))
          .sort()
          .reverse()
        if (snapshots.length > 0) {
          candidateFiles.push(join(backupDir, snapshots[0]))
        }
      } catch {}
    }

    for (const file of candidateFiles) {
      try {
        if (existsSync(file)) {
          const raw = readFileSync(file, 'utf-8')
          const parsed = JSON.parse(raw) as RallyState
          if (parsed && Array.isArray(parsed.teams) && parsed.teams.length > 0) {
            if (!Array.isArray(parsed.roster)) {
              parsed.roster = []
            }
            if (!Array.isArray(parsed.excludedUsers)) {
              parsed.excludedUsers = []
            }
            if (!Array.isArray(parsed.adminUsernames)) {
              parsed.adminUsernames = []
            }
            if (!parsed.title || parsed.title.includes('一步一善')) {
              parsed.title = '荣耀征程 · 大型团队竞技与拉练争霸赛'
            }
            if (!parsed.theme || parsed.theme.includes('乡村孩子')) {
              parsed.theme = '凝心聚力，勇攀高峰，向胜利全速进发！'
            }
            if (file !== this.filePath) {
              console.warn(`⚠️ 主数据文件缺失或损坏，已成功从备份文件恢复数据: ${file}`)
              // 自动修复主数据文件
              this.saveState(parsed)
            }
            return parsed
          }
        }
      } catch (err) {
        console.warn(`读取数据文件 ${file} 异常:`, err)
      }
    }

    console.warn('未找到有效的数据文件或备份，将初始化默认战队数据')

    const defaultState: RallyState = {
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

    const jsonContent = JSON.stringify(stateToSave, null, 2)
    const tempFile = `${this.filePath}.tmp.${Date.now()}`

    try {
      // 1. 写入临时文件并通过 fsyncSync 强制写入物理硬件扇区，杜绝内存未落盘风险
      const fd = openSync(tempFile, 'w')
      writeFileSync(fd, jsonContent, 'utf-8')
      fsyncSync(fd)
      closeSync(fd)

      // 2. 备份现有主数据文件为 .bak
      if (existsSync(this.filePath)) {
        try {
          copyFileSync(this.filePath, `${this.filePath}.bak`)
        } catch (e) {
          console.warn('备份主数据文件为 .bak 异常:', e)
        }
      }

      // 3. 原子重命名生效
      renameSync(tempFile, this.filePath)

      // 4. 实时快照归档 (滚动保留最新 100 份历史快照，支持时间点任意灾难恢复)
      try {
        const backupDir = join(dir, 'backups')
        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true })
        }
        const now = new Date()
        const dateTag = now.toISOString().replace(/[:.]/g, '-')
        const snapshotFile = join(backupDir, `rally-${dateTag}.json`)
        writeFileSync(snapshotFile, jsonContent, 'utf-8')

        const snapshotList = readdirSync(backupDir)
          .filter((f) => f.startsWith('rally-') && f.endsWith('.json'))
          .sort()
        if (snapshotList.length > 100) {
          for (const oldFile of snapshotList.slice(0, snapshotList.length - 100)) {
            try {
              unlinkSync(join(backupDir, oldFile))
            } catch {}
          }
        }
      } catch (backupErr) {
        console.warn('历史快照归档警告:', backupErr)
      }

      // 5. 宿主机双重实时存储目录同步（若挂载了 /app/host_backups）
      const hostBackupDirs = ['/app/host_backups', '/app/data_backups']
      for (const hDir of hostBackupDirs) {
        if (existsSync(hDir)) {
          try {
            writeFileSync(join(hDir, 'rally_realtime.json'), jsonContent, 'utf-8')
            writeFileSync(join(hDir, 'rally_latest.json'), jsonContent, 'utf-8')
          } catch (hErr) {
            console.warn(`同步至宿主机目录 ${hDir} 警告:`, hErr)
          }
        }
      }
    } catch (err) {
      console.error('CRITICAL: 持久化保存报名数据发生异常:', err)
      throw err
    }
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
        votes: team.votes,
        voteRanking: stats.voteRanking,
        currentLeader: stats.currentElectedLeader,
        totalVotes: stats.totalVotes,
      }
    })
  }

  // 获取当前系统所有报名情况及状态（优先使用花名册，可联动 LDAP）
  public async getSnapshot(isAdmin = false) {
    let allEmployees: import('./ldap.ts').LdapEmployee[] = []

    if (this.state.roster && this.state.roster.length > 0) {
      allEmployees = this.state.roster.map((r) => ({
        username: r.name,
        displayName: r.name,
        department: r.department || '未分配部门',
        title: r.note || '队员',
        email: r.phone || '',
      }))
    } else if (appConfig.ldap.enabled) {
      try {
        allEmployees = await (await import('./ldap.ts')).fetchLdapEmployees()
      } catch (e) {
        console.warn('获取 LDAP 员工失败:', e)
      }
    }

    // 结合员工信息丰富免报名名单的部门和姓名
    const employeeMap = new Map(allEmployees.map((e) => [e.username.toLowerCase(), e]))

    // 自动将队伍中现有成员的部门校准
    let teamsDepartmentUpdated = false
    for (const t of this.state.teams) {
      for (const m of t.members) {
        const emp = employeeMap.get(m.username.toLowerCase()) || employeeMap.get(m.displayName.toLowerCase())
        if (emp && emp.department && m.department !== emp.department) {
          m.department = emp.department
          teamsDepartmentUpdated = true
        }
      }
    }
    if (teamsDepartmentUpdated) {
      this.saveState()
    }

    const teams = this.getTeamsSummary()
    const registeredUsernames = new Set<string>()
    for (const t of teams) {
      for (const m of t.members) {
        registeredUsernames.add(m.username.toLowerCase())
        registeredUsernames.add(m.displayName.toLowerCase())
      }
    }

    const excludedUsers = this.state.excludedUsers || []
    const excludedUsernamesSet = new Set(excludedUsers.map((u) => u.username.toLowerCase()))

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
        !registeredUsernames.has(e.displayName.toLowerCase()) &&
        !excludedUsernamesSet.has(e.username.toLowerCase()) &&
        !excludedUsernamesSet.has(e.displayName.toLowerCase()),
    )

    const departments = [
      ...new Set(allEmployees.map((e) => e.department).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'zh-CN'))

    const totalMembers = teams.reduce((acc, t) => acc + t.memberCount, 0)
    const maxCapacity = teams.reduce((acc, t) => acc + t.maxMembers, 0)
    const targetCapacity = teams.reduce((acc, t) => acc + t.targetMembers, 0)

    const totalCompanyEmployees = allEmployees.length > 0
      ? allEmployees.length
      : Math.max(totalMembers, maxCapacity > 0 ? maxCapacity : 100)

    const excludedCount = enrichedExcludedEmployees.length
    const eligibleEmployeesCount = Math.max(0, totalCompanyEmployees - excludedCount)
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
    user: { username: string; displayName: string; department?: string },
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
      department: user.department,
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

  // 设置每队人数上限（支持独立设置每支队伍、单独某队、或统一设置全局上限，并严格校验合计人数不能超过总人数）
  public updateTeamCapacity(
    options:
      | number
      | {
          maxMembers?: number
          teamId?: number
          teamCapacities?: Record<string | number, number>
        },
    legacyTeamId?: number,
  ): { success: boolean; message: string; maxPerTeam: number } {
    const rosterCount = this.state.roster?.length || 0
    const allEmployees = getCachedEmployees()
    const totalCompanyEmployees = rosterCount > 0
      ? rosterCount
      : (allEmployees.length > 0 ? allEmployees.length : 1000)

    // 1. 批量独立设置各队人数上限：{ teamCapacities: { 1: 14, 2: 15, ... } }
    if (typeof options === 'object' && options.teamCapacities) {
      const capacities = options.teamCapacities
      let totalCapacity = 0
      const updates: Array<{ team: Team; limit: number }> = []

      for (const team of this.state.teams) {
        const rawLimit = capacities[team.id] !== undefined ? capacities[team.id] : team.maxMembers
        const limit = Math.floor(Number(rawLimit))
        if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
          return {
            success: false,
            message: `【${team.name}】的人数上限必须是 1 到 100 之间的整数`,
            maxPerTeam: this.state.activityRules.maxPerTeam,
          }
        }
        if (team.members.length > limit) {
          return {
            success: false,
            message: `【${team.name}】当前已有 ${team.members.length} 人，上限人数不能低于已有成员数`,
            maxPerTeam: this.state.activityRules.maxPerTeam,
          }
        }
        totalCapacity += limit
        updates.push({ team, limit })
      }

      // 核心规则：队伍合计人数不能超过总人数（当有录入名单或员工时生效）
      if (rosterCount > 0 && totalCapacity > totalCompanyEmployees) {
        return {
          success: false,
          message: `各队伍人数上限总和（${totalCapacity}人）不能超过总人数（${totalCompanyEmployees}人）`,
          maxPerTeam: this.state.activityRules.maxPerTeam,
        }
      }

      for (const item of updates) {
        item.team.maxMembers = item.limit
      }
      this.state.activityRules.maxPerTeam = Math.max(...this.state.teams.map((t) => t.maxMembers))
      this.saveState()

      return {
        success: true,
        message: `已成功保存各队独立人数上限（合计 ${totalCapacity} 人 / 上限 ${totalCompanyEmployees} 人）`,
        maxPerTeam: this.state.activityRules.maxPerTeam,
      }
    }

    // 2. 单独设置某一支队伍的人数上限
    const targetTeamId =
      typeof options === 'object' ? options.teamId : legacyTeamId
    const targetMaxMembers =
      typeof options === 'object' ? options.maxMembers : options

    const limit = Math.floor(Number(targetMaxMembers))
    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
      return {
        success: false,
        message: '队伍人数上限必须是 1 到 100 之间的整数',
        maxPerTeam: this.state.activityRules.maxPerTeam,
      }
    }

    if (targetTeamId) {
      const team = this.state.teams.find((t) => t.id === targetTeamId)
      if (!team) {
        return {
          success: false,
          message: '指定队伍不存在',
          maxPerTeam: this.state.activityRules.maxPerTeam,
        }
      }
      if (team.members.length > limit) {
        return {
          success: false,
          message: `【${team.name}】当前已有 ${team.members.length} 人，上限人数不能低于已有成员数`,
          maxPerTeam: this.state.activityRules.maxPerTeam,
        }
      }

      const totalCapacity = this.state.teams.reduce(
        (acc, t) => acc + (t.id === targetTeamId ? limit : t.maxMembers),
        0,
      )
      if (rosterCount > 0 && totalCapacity > totalCompanyEmployees) {
        return {
          success: false,
          message: `调整后各队人数上限总和（${totalCapacity}人）超过了总人数（${totalCompanyEmployees}人）`,
          maxPerTeam: this.state.activityRules.maxPerTeam,
        }
      }

      team.maxMembers = limit
      this.state.activityRules.maxPerTeam = Math.max(...this.state.teams.map((t) => t.maxMembers))
      this.saveState()
      return {
        success: true,
        message: `已将【${team.name}】的人数上限调整为 ${limit} 人（合计 ${totalCapacity} / ${totalCompanyEmployees} 人）`,
        maxPerTeam: this.state.activityRules.maxPerTeam,
      }
    }

    // 3. 全局统一调整
    const totalCapacity = limit * this.state.teams.length
    if (rosterCount > 0 && totalCapacity > totalCompanyEmployees) {
      return {
        success: false,
        message: `统一设为 ${limit} 人将导致队伍总容量（${totalCapacity}人）超过总人数（${totalCompanyEmployees}人），请降低单队上限或使用独立队伍设置`,
        maxPerTeam: this.state.activityRules.maxPerTeam,
      }
    }

    const overflowingTeams = this.state.teams.filter((t) => t.members.length > limit)
    if (overflowingTeams.length > 0) {
      const names = overflowingTeams.map((t) => `【${t.name}】(${t.members.length}人)`).join('、')
      return {
        success: false,
        message: `无法将全局上限设为 ${limit} 人，因为 ${names} 的现有成员数已超过该上限`,
        maxPerTeam: this.state.activityRules.maxPerTeam,
      }
    }

    this.state.activityRules.maxPerTeam = limit
    for (const team of this.state.teams) {
      team.maxMembers = limit
    }
    this.saveState()

    return {
      success: true,
      message: `已成功将各队人数上限统一设置为 ${limit} 人（合计 ${totalCapacity} / ${totalCompanyEmployees} 人）`,
      maxPerTeam: limit,
    }
  }

  // 获取当前花名册
  public getRoster(): RosterUser[] {
    return this.state.roster || []
  }

  // 根据姓名匹配花名册人员（不区分全半角及首尾空格）
  public findRosterUserByName(name: string): RosterUser[] {
    const clean = name.trim().toLowerCase()
    if (!clean) return []
    return (this.state.roster || []).filter((u) => u.name.trim().toLowerCase() === clean)
  }

  // Excel 导入花名册
  public importRosterFromExcel(buffer: Buffer): {
    success: boolean
    message: string
    count: number
    duplicates: number
  } {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        return { success: false, message: 'Excel 文件中未找到任何工作表', count: 0, duplicates: 0 }
      }
      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        return { success: false, message: 'Excel 表中无有效数据', count: 0, duplicates: 0 }
      }

      if (!this.state.roster) {
        this.state.roster = []
      }

      let importedCount = 0
      let updatedCount = 0

      for (const row of rawRows) {
        // 智能匹配列名
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
          } else if (k.includes('部门') || k.includes('单位') || k.includes('组别') || k === 'department') {
            department = v
          } else if (k.includes('手机') || k.includes('电话') || k === 'phone' || k === 'mobile') {
            phone = v
          } else if (k.includes('备注') || k === 'note' || k === '说明') {
            note = v
          }
        }

        if (!name) continue

        const existing = this.state.roster.find(
          (u) => u.name.trim().toLowerCase() === name.toLowerCase(),
        )

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

      this.saveState()
      return {
        success: true,
        message: `导入成功！新增 ${importedCount} 人，更新 ${updatedCount} 人`,
        count: importedCount,
        duplicates: updatedCount,
      }
    } catch (err: any) {
      console.error('Excel 导入异常:', err)
      return { success: false, message: `解析 Excel 失败: ${err?.message || '文件格式不正确'}`, count: 0, duplicates: 0 }
    }
  }

  // 手动单人添加花名册
  public addRosterUser(data: {
    name: string
    department?: string
    phone?: string
    note?: string
    isAdmin?: boolean
  }): { success: boolean; message: string; user?: RosterUser } {
    const name = data.name?.trim()
    if (!name) {
      return { success: false, message: '姓名不能为空' }
    }

    if (!this.state.roster) {
      this.state.roster = []
    }

    const existing = this.state.roster.find(
      (u) => u.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (existing) {
      existing.department = data.department?.trim() || existing.department
      existing.phone = data.phone?.trim() || existing.phone
      existing.note = data.note?.trim() || existing.note
      if (data.isAdmin !== undefined) existing.isAdmin = data.isAdmin
      this.saveState()
      return { success: true, message: `【${name}】已在名单中，已更新其信息`, user: existing }
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
    this.saveState()
    return { success: true, message: `已成功将【${name}】录入参赛名单`, user: newUser }
  }

  // 删除花名册人员
  public removeRosterUser(idOrName: string): { success: boolean; message: string } {
    if (!this.state.roster) return { success: false, message: '名单为空' }
    const target = idOrName.trim().toLowerCase()
    const index = this.state.roster.findIndex(
      (u) => u.id.toLowerCase() === target || u.name.toLowerCase() === target,
    )
    if (index === -1) {
      return { success: false, message: '未找到该人员' }
    }

    const removed = this.state.roster.splice(index, 1)[0]
    // 同步从队伍中移除
    this.leaveTeam(removed.name)
    this.saveState()
    return { success: true, message: `已从名单中移除【${removed.name}】` }
  }

  // 新增队伍
  public addTeam(data: {
    name: string
    slogan?: string
    description?: string
    icon?: string
    maxMembers?: number
  }): { success: boolean; message: string; team?: Team } {
    const name = data.name?.trim()
    if (!name) {
      return { success: false, message: '队伍名称不能为空' }
    }
    if (this.state.teams.some((t) => t.name === name)) {
      return { success: false, message: `队伍【${name}】已存在，请使用其他名称` }
    }

    const nextId = this.state.teams.length > 0
      ? Math.max(...this.state.teams.map((t) => t.id)) + 1
      : 1

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
    this.saveState()
    return { success: true, message: `已成功创建队伍【${name}】`, team: newTeam }
  }

  // 删除队伍
  public deleteTeam(teamId: number): { success: boolean; message: string } {
    const index = this.state.teams.findIndex((t) => t.id === teamId)
    if (index === -1) {
      return { success: false, message: '队伍不存在' }
    }
    const team = this.state.teams[index]
    this.state.teams.splice(index, 1)
    this.state.activityRules.totalTeams = this.state.teams.length
    this.saveState()
    return { success: true, message: `已成功解散并删除队伍【${team.name}】` }
  }

  // 更新活动规则和主题配置
  public updateActivityConfig(config: {
    title?: string
    theme?: string
    targetStepsDaily?: number
    totalKmTarget?: number
    totalStepsTarget?: number
  }): { success: boolean; message: string } {
    if (config.title?.trim()) {
      this.state.title = config.title.trim()
    }
    if (config.theme?.trim()) {
      this.state.theme = config.theme.trim()
    }
    if (config.targetStepsDaily && Number(config.targetStepsDaily) > 0) {
      this.state.activityRules.targetStepsDaily = Number(config.targetStepsDaily)
    }
    if (config.totalKmTarget && Number(config.totalKmTarget) > 0) {
      this.state.activityRules.totalKmTarget = Number(config.totalKmTarget)
    }
    if (config.totalStepsTarget && Number(config.totalStepsTarget) > 0) {
      this.state.activityRules.totalStepsTarget = Number(config.totalStepsTarget)
    }
    this.saveState()
    return { success: true, message: '活动配置已更新' }
  }
}

export const rallyStore = new RallyStore()
