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
        const dn = String(g.dn || '')
        // 从 DN 提取层级链路，找出直接挂载在公司节点下的 1 级部门
        // 示例: cn=江苏办事处,cn=东区作战平台,cn=联合作战指挥中心,cn=湖南承希科技有限公司,ou=groups,dc=chencytech,dc=com
        const cns: string[] = []
        const parts = dn.split(',')
        for (const p of parts) {
          const trimmed = p.trim()
          if (trimmed.toLowerCase().startsWith('cn=')) {
            cns.push(trimmed.slice(3).trim())
          }
        }

        let companyIdx = -1
        for (let i = cns.length - 1; i >= 0; i--) {
          if (cns[i].includes('公司') || cns[i].includes('承希')) {
            companyIdx = i
            break
          }
        }

        let level1Name = ''
        if (companyIdx > 0) {
          level1Name = cns[companyIdx - 1]
        } else if (cns.length > 0) {
          level1Name = cns[cns.length - 1]
        }

        // 规范化别名命名
        if (level1Name === '联合指挥作战中心') {
          level1Name = '联合作战指挥中心'
        }

        const cn = Array.isArray(g.cn) ? g.cn[0] : g.cn
        if (!level1Name && cn) {
          level1Name = String(cn)
        }
        if (!level1Name) {
          level1Name = '其他部门'
        }

        if (cn) {
          deptMap.set(String(cn), level1Name)
        }

        const descList = Array.isArray(g.description) ? g.description : [g.description]
        for (const d of descList) {
          if (typeof d === 'string' && d.includes('xrxsDepartmentId=')) {
            const match = d.match(/xrxsDepartmentId=([a-zA-Z0-9]+)/)
            if (match && match[1]) {
              deptMap.set(`dept-${match[1]}`, level1Name)
              deptMap.set(match[1], level1Name)
            }
          }
        }
        if (g.ou) {
          const ouVal = Array.isArray(g.ou) ? g.ou[0] : g.ou
          deptMap.set(String(ouVal), level1Name)
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
      let departmentName = deptMap.get(ouStr) || (ouStr && !ouStr.startsWith('dept-') ? ouStr : '其他部门')
      if (deptMap.has(departmentName)) {
        departmentName = deptMap.get(departmentName)!
      }
      if (departmentName === '联合指挥作战中心') {
        departmentName = '联合作战指挥中心'
      }
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

export function getCachedEmployees(): LdapEmployee[] {
  return cachedEmployees
}
