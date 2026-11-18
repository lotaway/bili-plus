import { test, expect } from '../fixtures/extension.fixture'

const VIDEO_URL = 'https://www.bilibili.com/video/BV1L3sz6vEza/?'
// 真实网络下载

test('从指定视频页面解析并进行页面上下文下载（真实网络）', async ({ context, extensionId, sidepanelPage }) => {
    // 真实网络 + 完整音视频下载，CI 上可能明显慢于本地默认超时。
    test.setTimeout(180_000)

    const page = await context.newPage()
    await page.goto(VIDEO_URL)
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/entry/sidepanel/index.html`)
    await sidepanelPage.getByRole('button', { name: '视频下载' }).click()

    const parseButton = sidepanelPage.getByRole('button', { name: '从当前页面解析' })
    const parsedStatus = sidepanelPage.getByText(/已解析: BVID=/)

    // 内容脚本会把视频信息异步同步给后台，页面刚加载完时后台可能还没有数据。
    // 真实用户也会等到解析成功后再点下载，这里按同样方式重试解析直到成功。
    await expect(async () => {
        await parseButton.click()
        await expect(parsedStatus).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 60_000 })

    await sidepanelPage.getByRole('combobox', { name: '下载类型:' }).selectOption({ label: '视频+音频（需手动合并）' })
    const dl = page.waitForEvent('download', { timeout: 120_000 })
    await sidepanelPage.getByRole('button', { name: /视频\+音频/ }).click()
    const first = await dl
    const name = first.suggestedFilename()
    expect(name.endsWith('.mp4') || name.endsWith('.m4a')).toBeTruthy()
})
