import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/extension.fixture'

const VIDEO_URL = 'https://www.bilibili.com/video/BV1L3sz6vEza/?'
const VIDEO_BVID = 'BV1L3sz6vEza'
// 真实网络下载

/**
 * B 站会根据浏览器语言在文档加载完后再做一次整页跳转
 * （CI 的 en-US 会跳到 /en/video/...）。
 * 跳转会销毁页面上下文，让正在进行的 fetch 中止并报 "Failed to fetch"，
 * 所以先等 URL 稳定下来，再等内容脚本和页面数据就绪。
 */
async function waitForVideoPageReady(page: Page, stableMs = 5_000, timeout = 45_000) {
    const deadline = Date.now() + timeout
    let lastUrl = ''
    let stableSince = Date.now()

    while (Date.now() < deadline) {
        const url = page.url()
        if (url !== lastUrl) {
            lastUrl = url
            stableSince = Date.now()
        } else if (Date.now() - stableSince >= stableMs && /\/video\/BV/.test(url)) {
            break
        }
        await page.waitForTimeout(200)
    }

    expect(page.url()).toMatch(/\/video\/BV/)
    await page.waitForLoadState('load')

    // 内容脚本注入的按钮 + 页面自带的视频数据，都是下载流程的前提。
    await expect(page.locator('#bili-plus-generate-btn')).toBeAttached({ timeout: 30_000 })
    await page.waitForFunction(() => Boolean((window as any).__INITIAL_STATE__?.videoData), undefined, { timeout: 30_000 })
}

test('从指定视频页面解析并进行页面上下文下载（真实网络）', async ({ context, extensionId, sidepanelPage }) => {
    // 真实网络 + 完整音视频下载，CI 上可能明显慢于本地默认超时。
    test.setTimeout(180_000)

    const page = await context.newPage()
    await page.goto(VIDEO_URL)
    await waitForVideoPageReady(page)

    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/entry/sidepanel/index.html`)
    await sidepanelPage.getByRole('button', { name: '视频下载' }).click()

    const parseButton = sidepanelPage.getByRole('button', { name: '从当前页面解析' })
    const parsedStatus = sidepanelPage.getByText(new RegExp(`已解析: BVID=${VIDEO_BVID}`))

    // 内容脚本会把视频信息异步同步给后台，页面刚加载完时后台可能还没有数据。
    // 真实用户也会等到解析成功后再点下载，这里按同样方式重试解析直到成功。
    await expect(async () => {
        await parseButton.click()
        await expect(parsedStatus).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 60_000 })

    await sidepanelPage.getByRole('combobox', { name: '下载类型:' }).selectOption({ label: '视频+音频（需手动合并）' })

    // 解析期间若又发生跳转，页面数据会被重建，下载同样会失败，这里再确认一次。
    await waitForVideoPageReady(page, 2_000)

    // 侧边栏在这里是一个扩展页面标签，下载模块会向“当前激活标签页”发消息。
    // 真实使用时侧边栏依附于视频页，这里把视频页切到前台以模拟同样的场景。
    await page.bringToFront()

    const dl = page.waitForEvent('download', { timeout: 120_000 })
    await sidepanelPage.getByRole('button', { name: /视频\+音频/ }).click()
    const first = await dl
    const name = first.suggestedFilename()
    expect(name.endsWith('.mp4') || name.endsWith('.m4a')).toBeTruthy()
})
