import * as XLSX from 'xlsx'
import { rallyStore, type Team } from './store.ts'

export async function generateRallyExcelBuffer(): Promise<Buffer> {
  const snapshot = await rallyStore.getSnapshot()
  const memberRows: Array<Record<string, any>> = []
  const teamSummaryRows: Array<Record<string, any>> = []
  const unassignedRows: Array<Record<string, any>> = []

  let globalIndex = 1

  for (const team of snapshot.teams) {
    const leaderUser = team.currentLeader?.username

    teamSummaryRows.push({
      '队伍编号': `第 ${team.id} 队`,
      '队伍名称': team.name,
      '队伍口号': team.slogan,
      '当前人数': team.memberCount,
      '目标人数': team.targetMembers,
      '人数上限': team.maxMembers,
      '满员状态': team.isFull ? '已满员' : `缺 ${team.maxMembers - team.memberCount} 人`,
      '推选队长': team.currentLeader ? `${team.currentLeader.displayName} (${team.currentLeader.username})` : '未决出',
      '队内已投票数': team.totalVotes,
    })

    for (const member of team.members) {
      const isLeader = member.username === leaderUser
      const voteStat = team.voteRanking.find((v) => v.candidateUsername === member.username)
      const votesReceived = voteStat ? voteStat.count : 0
      const votedTargetUsername = team.votes[member.username]
      const votedTargetMember = team.members.find((m) => m.username === votedTargetUsername)
      const votedFor = votedTargetMember ? `${votedTargetMember.displayName}` : '未投票'

      memberRows.push({
        '序号': globalIndex++,
        '队伍序号': `第 ${team.id} 队`,
        '队伍名称': team.name,
        '队员姓名': member.displayName,
        '用户工号/账号': member.username,
        '队内身份': isLeader ? '👑 推选队长' : '队员',
        '获得推选票数': votesReceived,
        '选票去向': votedFor,
        '报名时间': new Date(member.joinedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        '口号': member.note || '-',
      })
    }
  }

  // 待组队同事
  let uIndex = 1
  for (const u of snapshot.unassignedEmployees || []) {
    unassignedRows.push({
      '序号': uIndex++,
      '姓名': u.displayName,
      '工号/账号': u.username,
      '所属部门': u.department,
      '状态': '待加入队伍',
    })
  }

  const wb = XLSX.utils.book_new()

  // Sheet 1: 队员花名册
  const wsMembers = XLSX.utils.json_to_sheet(memberRows)
  XLSX.utils.book_append_sheet(wb, wsMembers, '全员报名花名册')

  // Sheet 2: 队伍统计表
  const wsTeams = XLSX.utils.json_to_sheet(teamSummaryRows)
  XLSX.utils.book_append_sheet(wb, wsTeams, '各小队概况')

  // Sheet 3: 未报名同事
  const wsUnassigned = XLSX.utils.json_to_sheet(unassignedRows)
  XLSX.utils.book_append_sheet(wb, wsUnassigned, '待组队同事名单')

  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return excelBuffer as Buffer
}
