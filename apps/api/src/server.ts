import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, createReadStream, statSync } from 'node:fs'
import { resolve, extname, join } from 'node:path'
import { appConfig } from './config.ts'
import {
  currentUser,
  isUserAdmin,
  oidcLogin,
  oidcCallback,
  createMockSession,
  logout,
  jsonResponse,
  type AuthRouteResponse,
} from './auth.ts'
import { rallyStore } from './store.ts'
import { generateRallyExcelBuffer } from './export.ts'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((res, rej) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1024 * 1024) {
        rej(new Error('Payload too large'))
      }
    })
    req.on('end', () => {
      try {
        res(body ? JSON.parse(body) : {})
      } catch (e) {
        rej(e)
      }
    })
    req.on('error', rej)
  })
}

function sendResponse(res: ServerResponse, resp: AuthRouteResponse) {
  res.statusCode = resp.status
  if (resp.headers) {
    for (const [k, v] of Object.entries(resp.headers)) {
      if (v !== undefined) {
        res.setHeader(k, v)
      }
    }
  }
  if (resp.body !== undefined) {
    res.end(typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body))
  } else {
    res.end()
  }
}

function serveStatic(reqPath: string, res: ServerResponse): boolean {
  const publicDir = resolve(process.cwd(), appConfig.publicDir)
  if (!existsSync(publicDir)) return false

  let safePath = reqPath.replace(/^\/+/, '')
  let target = join(publicDir, safePath)

  if (!existsSync(target) || statSync(target).isDirectory()) {
    target = join(publicDir, 'index.html')
  }

  if (existsSync(target) && statSync(target).isFile()) {
    const ext = extname(target).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    })
    createReadStream(target).pipe(res)
    return true
  }

  return false
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${appConfig.port}`
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const requestUrl = new URL(req.url ?? '/', `${protocol}://${host}`)
    const pathname = requestUrl.pathname

    // CORS headers for local dev if needed
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    // API 路由分发
    if (pathname === '/healthz') {
      sendResponse(res, jsonResponse(200, { status: 'healthy', timestamp: new Date().toISOString() }))
      return
    }

    if (pathname.startsWith('/api/v1/')) {
      const user = currentUser(req)

      const isGetOrHead = req.method === 'GET' || req.method === 'HEAD'

      // 1. 获取当前用户认证状态及队伍状态
      if (isGetOrHead && pathname === '/api/v1/auth/me') {
        const teamInfo = user ? rallyStore.findUserTeam(user.username) : null
        sendResponse(
          res,
          jsonResponse(200, {
            authenticated: Boolean(user),
            user: user
              ? {
                  id: user.id,
                  username: user.username,
                  displayName: user.displayName,
                  isAdmin: isUserAdmin(user.username),
                  authSource: user.authSource,
                }
              : null,
            myTeam: teamInfo
              ? {
                  id: teamInfo.team.id,
                  name: teamInfo.team.name,
                  slogan: teamInfo.team.slogan,
                  myVote: teamInfo.team.votes[user!.username] || null,
                  joinedAt: teamInfo.member.joinedAt,
                }
              : null,
            authConfig: {
              mode: appConfig.auth.mode,
              hasOidc: Boolean(appConfig.auth.issuer && appConfig.auth.clientId),
            },
          }),
        )
        return
      }

      // 2. OIDC 登录跳转
      if (isGetOrHead && pathname === '/api/v1/auth/oidc/login') {
        const authResp = await oidcLogin(req)
        sendResponse(res, authResp)
        return
      }

      // 3. OIDC 回调
      if (isGetOrHead && pathname === '/api/v1/auth/oidc/callback') {
        const authResp = await oidcCallback(req, requestUrl)
        sendResponse(res, authResp)
        return
      }

      // 4. 便捷/快速模拟登录（支持自定义中文名和账号，方便本地或未配置 OIDC 时测试）
      if (req.method === 'POST' && pathname === '/api/v1/auth/mock-login') {
        const body = await parseJsonBody(req)
        const username = String(body.username || '').trim()
        const displayName = String(body.displayName || '').trim() || username
        if (!username) {
          sendResponse(res, jsonResponse(400, { error: '请输入用户名或工号' }))
          return
        }
        const { user: newUser, cookieHeader } = createMockSession(username, displayName)
        sendResponse(res, {
          status: 200,
          headers: {
            'set-cookie': cookieHeader,
            'content-type': 'application/json; charset=utf-8',
          },
          body: { success: true, user: newUser },
        })
        return
      }

      // 5. 退出登录
      if (req.method === 'GET' && pathname === '/api/v1/auth/logout') {
        sendResponse(res, logout())
        return
      }

      // 6. 获取所有队伍与活动概览数据
      if (isGetOrHead && pathname === '/api/v1/teams') {
        const snapshot = await rallyStore.getSnapshot()
        sendResponse(res, jsonResponse(200, snapshot))
        return
      }

      // 7. 报名加入队伍
      if (req.method === 'POST' && pathname === '/api/v1/teams/join') {
        if (!user) {
          sendResponse(res, jsonResponse(401, { error: '请先登录后再参与报名组队' }))
          return
        }
        const body = await parseJsonBody(req)
        const teamId = Number(body.teamId)
        if (!teamId || teamId < 1 || teamId > 10) {
          sendResponse(res, jsonResponse(400, { error: '请选择合法的队伍（1-10队）' }))
          return
        }
        const targetUser = body.targetUsername
          ? { username: String(body.targetUsername).trim(), displayName: String(body.targetDisplayName || body.targetUsername).trim() }
          : user
        const result = rallyStore.joinTeam(teamId, targetUser, {
          mobile: body.mobile,
          note: body.note,
          switchTeam: Boolean(body.switchTeam),
        })
        sendResponse(res, jsonResponse(result.success ? 200 : 400, result))
        return
      }

      // 8. 退出队伍
      if (req.method === 'POST' && pathname === '/api/v1/teams/leave') {
        if (!user) {
          sendResponse(res, jsonResponse(401, { error: '请先登录' }))
          return
        }
        const result = rallyStore.leaveTeam(user.username)
        sendResponse(res, jsonResponse(result.success ? 200 : 400, result))
        return
      }

      // 9. 投票推选队长
      if (req.method === 'POST' && pathname === '/api/v1/teams/vote') {
        if (!user) {
          sendResponse(res, jsonResponse(401, { error: '请先登录后推选队长' }))
          return
        }
        const body = await parseJsonBody(req)
        const candidateUsername = String(body.candidateUsername || '').trim()
        if (!candidateUsername) {
          sendResponse(res, jsonResponse(400, { error: '请选择要推选的队长人选' }))
          return
        }
        const result = rallyStore.voteLeader(user.username, candidateUsername)
        sendResponse(res, jsonResponse(result.success ? 200 : 400, result))
        return
      }

      // 10. 更新队伍信息（队名与口号）
      if (req.method === 'POST' && pathname === '/api/v1/teams/update') {
        if (!user) {
          sendResponse(res, jsonResponse(401, { error: '请先登录' }))
          return
        }
        const body = await parseJsonBody(req)
        const teamId = Number(body.teamId)
        const result = rallyStore.updateTeam(
          teamId,
          { name: body.name, slogan: body.slogan },
          { username: user.username, isAdmin: isUserAdmin(user.username) },
        )
        sendResponse(res, jsonResponse(result.success ? 200 : 403, result))
        return
      }

      // 11. 导出报名名单 Excel (仅管理员允许导出)
      if (isGetOrHead && pathname === '/api/v1/export/excel') {
        if (!user || !isUserAdmin(user.username)) {
          sendResponse(res, jsonResponse(403, { error: '无权操作，仅系统管理员可导出花名册' }))
          return
        }
        const buffer = await generateRallyExcelBuffer()
        const filename = encodeURIComponent(`一步一善-重走经典红色路-报名花名册-${new Date().toISOString().slice(0, 10)}.xlsx`)
        res.writeHead(200, {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
          'content-length': buffer.length,
        })
        res.end(buffer)
        return
      }

      // 12. 管理员重置清空队伍
      if (req.method === 'POST' && pathname === '/api/v1/admin/reset') {
        if (!user || !isUserAdmin(user.username)) {
          sendResponse(res, jsonResponse(403, { error: '无权操作，仅系统管理员可执行' }))
          return
        }
        const body = await parseJsonBody(req)
        const teamId = Number(body.teamId)
        const result = rallyStore.resetTeam(teamId)
        sendResponse(res, jsonResponse(200, result))
        return
      }

      sendResponse(res, jsonResponse(404, { error: 'API 未找到' }))
      return
    }

    // 未登录时访问主页面直接 302 重定向到 OIDC 登录 (除非带有 ?mock=1 调试)
    const isMockParam = requestUrl.searchParams.get('mock') === '1'
    const isErrorParam = Boolean(requestUrl.searchParams.get('error'))
    const hasSessionUser = Boolean(currentUser(req))
    const isStaticAsset = /\.(js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff|woff2)$/i.test(pathname)

    if (!hasSessionUser && !isMockParam && !isErrorParam && !isStaticAsset && (pathname === '/' || pathname === '/index.html')) {
      const authResp = await oidcLogin(req)
      sendResponse(res, authResp)
      return
    }

    // 托管静态前端资源
    if (serveStatic(pathname, res)) {
      return
    }

    res.statusCode = 404
    res.end('Not Found')
  } catch (err: any) {
    console.error('Server unhandled error:', err)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }))
  }
})

server.listen(appConfig.port, appConfig.host, () => {
  console.log(`🚩 一步一善·重走经典红色路 系统已启动: http://${appConfig.host}:${appConfig.port}`)
})
