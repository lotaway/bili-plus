import { test, expect } from '../fixtures/extension.fixture'

const VIDEO_URL = 'https://www.bilibili.com/video/BV19PFGzMENr/?'
// 真实网络下载

test('从指定视频页面解析并进行页面上下文下载（真实网络）', async ({ context, extensionId, sidepanelPage }) => {
    const page = await context.newPage()
    await page.goto(VIDEO_URL)
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/entry/sidepanel/index.html`)
    await sidepanelPage.getByRole('button', { name: '视频下载' }).click()
    await sidepanelPage.getByRole('button', { name: '从当前页面解析' }).click()
    await sidepanelPage.getByRole('combobox', { name: '下载类型:' }).selectOption({ label: '视频+音频（需手动合并）' })
    const dl = page.waitForEvent('download')
    await sidepanelPage.getByRole('button', { name: /视频\+音频/ }).click()
    const first = await dl
    const name = first.suggestedFilename()
    expect(name.endsWith('.mp4') || name.endsWith('.m4a')).toBeTruthy()
})
