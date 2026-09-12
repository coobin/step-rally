import * as XLSX from 'xlsx'
import type { Team, ExcludedUser } from './types'

export function generateRallyExcelArray(snapshot: any): Uint8Array {
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
      const voteStat = team.voteRanking?.find((v: any) => v.candidateUsername === member.username)
      const votesReceived = voteStat ? voteStat.count : 0
      const votedTargetUsername = team.votes ? team.votes[member.username] : null
      const votedTargetMember = team.members.find((m: any) => m.username === votedTargetUsername)
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

  // 待组队人员
  let uIndex = 1
  for (const u of snapshot.unassignedEmployees || []) {
    unassignedRows.push({
      '序号': uIndex++,
      '姓名': u.displayName,
      '工号/账号': u.username,
      '所属部门': u.department || '-',
      '状态': '待加入队伍',
    })
  }

  // 免报名人员
  const excludedRows: Array<Record<string, any>> = []
  let eIndex = 1
  for (const e of snapshot.excludedEmployees || []) {
    excludedRows.push({
      '序号': eIndex++,
      '姓名': e.displayName,
      '工号/账号': e.username,
      '所属部门': e.department || '-',
      '免报原因': e.reason || '免参与',
      '设置时间': e.excludedAt ? new Date(e.excludedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '-',
      '操作人': e.excludedBy || '系统管理员',
    })
  }

  const wb = XLSX.utils.book_new()
  const wsMembers = XLSX.utils.json_to_sheet(memberRows)
  XLSX.utils.book_append_sheet(wb, wsMembers, '全员报名花名册')

  const wsTeams = XLSX.utils.json_to_sheet(teamSummaryRows)
  XLSX.utils.book_append_sheet(wb, wsTeams, '各小队概况')

  const wsUnassigned = XLSX.utils.json_to_sheet(unassignedRows)
  XLSX.utils.book_append_sheet(wb, wsUnassigned, '待组队人员名单')

  const wsExcluded = XLSX.utils.json_to_sheet(excludedRows)
  XLSX.utils.book_append_sheet(wb, wsExcluded, '免报名人员名单')

  const rawArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Uint8Array(rawArray)
}

export function generateRosterTemplateArray(): Uint8Array {
  const sampleRows = [
    {
      '姓名 (必填)': '张三',
      '部门 (选填)': '技术研发部',
      '手机号 (选填)': '13800000001',
      '备注 (选填)': '先锋队员',
    },
    {
      '姓名 (必填)': '李四',
      '部门 (选填)': '市场运营部',
      '手机号 (选填)': '13800000002',
      '备注 (选填)': '',
    },
    {
      '姓名 (必填)': '王五',
      '部门 (选填)': '综合管理部',
      '手机号 (选填)': '13800000003',
      '备注 (选填)': '',
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(sampleRows)
  XLSX.utils.book_append_sheet(wb, ws, '参赛花名册导入模板')
  const rawArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Uint8Array(rawArray)
}
