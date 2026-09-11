import { Client } from 'ldapts'
import { appConfig } from './config.ts'

export interface LdapEmployee {
  username: string
  displayName: string
  department: string
  title: string
  email?: string
}

let cachedEmployees: LdapEmployee[] = []
let lastFetchedAt = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 分钟缓存

export async function fetchLdapEmployees(): Promise<LdapEmployee[]> {
  if (!appConfig.ldap.uri) {
    return cachedEmployees
  }

  const now = Date.now()
  if (cachedEmployees.length > 0 && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedEmployees
  }

  const client = new Client({
    url: appConfig.ldap.uri,
    timeout: 5000,
    connectTimeout: 5000,
  })

  try {
    if (appConfig.ldap.bindDn && appConfig.ldap.bindPassword) {
      await client.bind(appConfig.ldap.bindDn, appConfig.ldap.bindPassword)
    }

    // 1. 查询部门名称映射 (ou=groups)
    const deptMap = new Map<string, string>()
    try {
      const groupsBase = `${appConfig.ldap.groupsOu},${appConfig.ldap.baseDn}`
      const { searchEntries: groupEntries } = await client.search(groupsBase, {
        scope: 'sub',
        filter: '(objectClass=*)',
        attributes: ['cn', 'description', 'ou'],
      })
      for (const g of groupEntries) {
        const cn = Array.isArray(g.cn) ? g.cn[0] : g.cn
        const descList = Array.isArray(g.description) ? g.description : [g.description]
        for (const d of descList) {
          if (typeof d === 'string' && d.includes('xrxsDepartmentId=')) {
            const match = d.match(/xrxsDepartmentId=([a-zA-Z0-9]+)/)
            if (match && match[1] && cn) {
              deptMap.set(`dept-${match[1]}`, String(cn))
              deptMap.set(match[1], String(cn))
            }
          }
        }
        if (g.ou && cn) {
          const ouVal = Array.isArray(g.ou) ? g.ou[0] : g.ou
          deptMap.set(String(ouVal), String(cn))
        }
      }
    } catch (e) {
      console.warn('LDAP 部门映射获取警告 (将使用原始部门标识):', e)
    }

    // 2. 查询全体在职人员 (ou=people)
    const peopleBase = `${appConfig.ldap.peopleOu},${appConfig.ldap.baseDn}`
    const { searchEntries: peopleEntries } = await client.search(peopleBase, {
      scope: 'sub',
      filter: '(objectClass=inetOrgPerson)',
      attributes: ['uid', 'displayName', 'cn', 'employeeType', 'ou', 'title', 'mail'],
    })

    const result: LdapEmployee[] = []

    for (const entry of peopleEntries) {
      const status = String(entry.employeeType || '').toLowerCase()
      if (status === 'deactive' || status === 'inactive') {
        continue
      }

      const uid = String(entry.uid || '').trim().toLowerCase()
      if (!uid || uid === 'admin' || uid === 'dev' || uid === 'root' || uid === 'guest') {
        continue
      }

      const nameAttr = entry.displayName || entry.cn
      const rawName = Array.isArray(nameAttr) ? nameAttr[0] : nameAttr
      const cleanDisplayName = String(rawName || '').trim()

      // 若完全没有姓名，或者是纯技术服务账号，跳过
      if (!cleanDisplayName || cleanDisplayName === 'admin' || cleanDisplayName === 'dev') {
        continue
      }

      const rawOu = Array.isArray(entry.ou) ? entry.ou[0] : entry.ou
      const ouStr = String(rawOu || '').trim()
      const departmentName = deptMap.get(ouStr) || (ouStr && !ouStr.startsWith('dept-') ? ouStr : '其他部门')
      const rawTitle = Array.isArray(entry.title) ? entry.title[0] : entry.title
      const title = String(rawTitle || '').trim() || '-'
      const rawMail = Array.isArray(entry.mail) ? entry.mail[0] : entry.mail
      const email = rawMail ? String(rawMail).trim() : undefined

      result.push({
        username: uid,
        displayName: cleanDisplayName,
        department: departmentName,
        title,
        email,
      })
    }

    // 拼音/姓名排序
    result.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'))

    cachedEmployees = result
    lastFetchedAt = now
    console.log(`✅ LDAP 在职员工信息已刷新，共加载 ${result.length} 位在职员工`)
    return result
  } catch (err) {
    console.error('LDAP 同步异常:', err)
    // 若查询失败且之前有缓存，则降级返回旧缓存
    if (cachedEmployees.length > 0) return cachedEmployees
    return []
  } finally {
    try {
      await client.unbind()
    } catch {}
  }
}
