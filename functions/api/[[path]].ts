import { Hono } from 'hono'
import type { Env, AuthUser } from '../types'
import { RallyEdgeStore } from '../store'
import {
  createSessionCookie,
  clearSessionCookie,
  getCurrentUserFromCookie,
} from '../auth'
import { generateRallyExcelArray, generateRosterTemplateArray } from '../export'

const app = new Hono<{ Bindings: Env }>()

// 辅助：获取当前请求的 Store
async function getStore(c: any): Promise<RallyEdgeStore> {
  const store = new RallyEdgeStore(c.env)
  await store.init()
  return store
}

// 辅助：获取当前用户
async function getUser(c: any): Promise<AuthUser | null> {
  const cookieHeader = c.req.header('cookie')
  const secret = c.env.SESSION_SECRET || 'step-rally-cf-pages-secret-2026!'
  return await getCurrentUserFromCookie(cookieHeader, secret)
}

// 1. 获取当前用户认证状态及队伍状态
app.get('/api/v1/auth/me', async (c) => {
  const store = await getStore(c)
  const user = await getUser(c)
  const teamInfo = user ? store.findUserTeam(user.username) : null

  return c.json({
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          isAdmin: store.isAdmin(user.username),
          authSource: user.authSource,
        }
      : null,
    myTeam: teamInfo
      ? {
          id: teamInfo.team.id,
          name: teamInfo.team.name,
          slogan: teamInfo.team.slogan,
          myVote: teamInfo.team.votes ? teamInfo.team.votes[user!.username] || null : null,
          joinedAt: teamInfo.member.joinedAt,
        }
      : null,
    authConfig: {
      mode: 'all',
      hasOidc: false,
    },
  })
})

// 2. 姓名直接登录
app.post('/api/v1/auth/login-by-name', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const department = String(body.department || '').trim() || undefined

  if (!name) {
    return c.json({ error: '请输入姓名' }, 400)
  }

  const store = await getStore(c)
  const candidates = store.findRosterUserByName(name)
  if (candidates.length === 0) {
    return c.json(
      { error: `未在参赛名单中找到【${name}】，请确认姓名或联系管理员导入名单` },
      404
    )
  }

  let target = candidates[0]
  if (candidates.length > 1 && department) {
    const matched = candidates.find((cand) => cand.department === department)
    if (matched) target = matched
  }

  const isAdmin = Boolean(target.isAdmin || store.isAdmin(target.name))
  const user: AuthUser = {
    id: target.id || target.name,
    username: target.name,
    displayName: target.name,
    department: target.department,
    roles: isAdmin ? ['admin', 'user'] : ['user'],
    authSource: 'roster',
  }

  const secret = c.env.SESSION_SECRET || 'step-rally-cf-pages-secret-2026!'
  const cookieStr = await createSessionCookie(user, secret)

  c.header('Set-Cookie', cookieStr)
  return c.json({
    success: true,
    message: `登录成功，欢迎【${user.displayName}】！`,
    user,
  })
})

// 3. 管理员密码快捷登录
app.post('/api/v1/auth/admin-login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const password = String(body.password || '').trim()
  const expectedPwd = c.env.ADMIN_PASSWORD || 'admin888'

  if (!password || password !== expectedPwd) {
    return c.json({ error: '管理员密码错误，请重试' }, 401)
  }

  const user: AuthUser = {
    id: 'admin',
    username: 'admin',
    displayName: '系统管理员',
    department: '组委会',
    roles: ['admin', 'user'],
    authSource: 'admin',
  }

  const secret = c.env.SESSION_SECRET || 'step-rally-cf-pages-secret-2026!'
  const cookieStr = await createSessionCookie(user, secret)

  c.header('Set-Cookie', cookieStr)
  return c.json({
    success: true,
    message: '管理员登录成功',
    user,
  })
})

// 4. 模拟登录
app.post('/api/v1/auth/mock-login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const username = String(body.username || '').trim()
  const displayName = String(body.displayName || '').trim() || username
  if (!username) {
    return c.json({ error: '请输入用户名' }, 400)
  }

  const store = await getStore(c)
  const isAdmin = store.isAdmin(username)
  const user: AuthUser = {
    id: `mock_${username}`,
    username,
    displayName,
    roles: isAdmin ? ['admin', 'user'] : ['user'],
    authSource: 'mock',
  }

  const secret = c.env.SESSION_SECRET || 'step-rally-cf-pages-secret-2026!'
  const cookieStr = await createSessionCookie(user, secret)

  c.header('Set-Cookie', cookieStr)
  return c.json({ success: true, user })
})

// 5. 退出登录
app.get('/api/v1/auth/logout', async (c) => {
  c.header('Set-Cookie', clearSessionCookie())
  return c.redirect('/')
})

// 6. 获取队伍和活动全景数据
app.get('/api/v1/teams', async (c) => {
  const store = await getStore(c)
  const user = await getUser(c)
  const isAdmin = Boolean(user && store.isAdmin(user.username))
  const snapshot = await store.getSnapshot(isAdmin)
  return c.json(snapshot)
})

// 7. 加入队伍
app.post('/api/v1/teams/join', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: '请先登录' }, 401)

  const body = await c.req.json().catch(() => ({}))
  const teamId = Number(body.teamId)
  if (!teamId) return c.json({ error: '缺少队伍编号' }, 400)

  const store = await getStore(c)
  let targetUser = {
    username: user.username,
    displayName: user.displayName,
    department: user.department,
  }

  if (body.targetUsername) {
    targetUser = {
      username: String(body.targetUsername),
      displayName: String(body.targetDisplayName || body.targetUsername),
      department: body.targetDepartment,
    }
  }

  const result = await store.joinTeam(teamId, targetUser, {
    note: body.note,
    switchTeam: Boolean(body.switchTeam),
  })

  return c.json(result, result.success ? 200 : 400)
})

// 8. 退出队伍
app.post('/api/v1/teams/leave', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: '请先登录' }, 401)

  const store = await getStore(c)
  const result = await store.leaveTeam(user.username)
  return c.json(result, result.success ? 200 : 400)
})

// 9. 队长投票
app.post('/api/v1/teams/vote', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: '请先登录' }, 401)

  const body = await c.req.json().catch(() => ({}))
  const candidateUsername = String(body.candidateUsername || '').trim()
  if (!candidateUsername) return c.json({ error: '请指定推选候选人' }, 400)

  const store = await getStore(c)
  const result = await store.voteLeader(user.username, candidateUsername)
  return c.json(result, result.success ? 200 : 400)
})

// 10. 更新队伍名称与口号
app.post('/api/v1/teams/update', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: '请先登录' }, 401)

  const body = await c.req.json().catch(() => ({}))
  const teamId = Number(body.teamId)
  if (!teamId) return c.json({ error: '缺少队伍编号' }, 400)

  const store = await getStore(c)
  const isAdmin = store.isAdmin(user.username)
  const result = await store.updateTeam(teamId, body, { username: user.username, isAdmin })
  return c.json(result, result.success ? 200 : 400)
})

// 11. 导出报名数据 Excel
app.get('/api/v1/export/excel', async (c) => {
  const store = await getStore(c)
  const snapshot = await store.getSnapshot(true)
  const uint8 = generateRallyExcelArray(snapshot)

  const headers = new Headers()
  headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  headers.set('Content-Disposition', 'attachment; filename="rally_teams.xlsx"')
  headers.set('Content-Length', String(uint8.byteLength))

  return new Response(uint8.buffer as ArrayBuffer, { status: 200, headers })
})

// 12. 下载花名册模板
app.get('/api/v1/admin/roster/template', async () => {
  const uint8 = generateRosterTemplateArray()
  const headers = new Headers()
  headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  headers.set('Content-Disposition', 'attachment; filename="roster_template.xlsx"')
  headers.set('Content-Length', String(uint8.byteLength))
  return new Response(uint8.buffer as ArrayBuffer, { status: 200, headers })
})

// 13. 获取后台设置详情
app.get('/api/v1/admin/settings', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) {
    return c.json({ error: '无权操作' }, 403)
  }
  return c.json(store.getAdminSettingsDetails())
})

// 14. 管理员配置人数上限
app.post('/api/v1/admin/settings/team-capacity', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const result = await store.updateTeamCapacity(body)
  return c.json(result, result.success ? 200 : 400)
})

// 15. 管理员增删管理员
app.post('/api/v1/admin/settings/admins', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const targetUsername = String(body.username || '').trim()
  const action = body.action === 'remove' ? 'remove' : 'add'
  if (!targetUsername) return c.json({ error: '请输入管理员账号' }, 400)

  const result = action === 'add'
    ? await store.addAdmin(targetUsername)
    : await store.removeAdmin(targetUsername, user.username)

  return c.json(result, result.success ? 200 : 400)
})

// 16. Excel 导入名单
app.post('/api/v1/admin/roster/import', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  if (!body.base64) return c.json({ error: '缺少 base64 数据' }, 400)

  let binary = atob(body.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const result = await store.importRosterFromExcel(bytes)
  return c.json(result, result.success ? 200 : 400)
})

// 17. 获取花名册名单
app.get('/api/v1/admin/roster/list', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)
  return c.json({ roster: store.getRoster() })
})

// 18. 手动录入单人
app.post('/api/v1/admin/roster/add', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const result = await store.addRosterUser(body)
  return c.json(result, result.success ? 200 : 400)
})

// 19. 删除花名册单人
app.post('/api/v1/admin/roster/delete', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const targetId = String(body.id || body.name || '').trim()
  const result = await store.removeRosterUser(targetId)
  return c.json(result, result.success ? 200 : 400)
})

// 20. 新建队伍
app.post('/api/v1/admin/teams/add', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const result = await store.addTeam(body)
  return c.json(result, result.success ? 200 : 400)
})

// 21. 删除队伍
app.post('/api/v1/admin/teams/delete', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const teamId = Number(body.teamId)
  const result = await store.deleteTeam(teamId)
  return c.json(result, result.success ? 200 : 400)
})

// 22. 更新活动配置
app.post('/api/v1/admin/activity/config', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const result = await store.updateActivityConfig(body)
  return c.json(result, result.success ? 200 : 400)
})

// 23. 重置队伍
app.post('/api/v1/admin/reset', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const teamId = Number(body.teamId)
  const result = await store.resetTeam(teamId)
  return c.json(result, result.success ? 200 : 400)
})

// 24. 免报名设置
app.post('/api/v1/admin/exclude-user', async (c) => {
  const user = await getUser(c)
  const store = await getStore(c)
  if (!user || !store.isAdmin(user.username)) return c.json({ error: '无权操作' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const username = String(body.username || '').trim()
  if (!username) return c.json({ error: '请提供员工工号或姓名' }, 400)

  const action = body.action === 'restore' ? 'restore' : 'exclude'
  const result = action === 'restore'
    ? await store.restoreUser(username)
    : await store.excludeUser({
        username,
        displayName: body.displayName,
        department: body.department,
      }, body.reason, user.username)

  return c.json(result, result.success ? 200 : 400)
})

export type PagesFunctionContext<E = Env> = {
  request: Request
  env: E
  waitUntil: (promise: Promise<any>) => void
  next: () => Promise<Response>
  data: Record<string, any>
}

// 导出 Cloudflare Pages Function 处理器
export const onRequest = (context: PagesFunctionContext) => {
  return app.fetch(context.request, context.env, context)
}
