const BILIBILI_HOSTNAMES = new Set(['www.bilibili.com', 'bilibili.com'])

/**
 * B 站首页路径。除中文主站 `/` 外，B 站还会根据浏览器语言把首页
 * 重定向到 `/en`，这类页面同样属于首页，扩展需要正常工作。
 */
const BILIBILI_HOMEPAGE_PATHS = new Set([
  '/',
  '/index.html',
  '/en',
  '/en/',
  '/en/index.html',
])

export function isBilibiliHomepageUrl(url?: string | null): boolean {
  if (!url) return false
  try {
    const { hostname, pathname } = new URL(url)
    return (
      BILIBILI_HOSTNAMES.has(hostname.toLowerCase()) &&
      BILIBILI_HOMEPAGE_PATHS.has(pathname.toLowerCase())
    )
  } catch {
    return false
  }
}
