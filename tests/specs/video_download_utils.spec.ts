import { test, expect } from '../fixtures/extension.fixture'

test('DownloadUtils 应包含 Referer 头并能读取响应为 Blob', async ({ sidepanelPage }) => {
  const url = 'https://example.com/test.bin'
  const payload = new Uint8Array(1024)

  await sidepanelPage.route('**/test.bin', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      headers: { 'content-length': String(payload.byteLength) },
      body: Buffer.from(payload)
    })
  })

  const size = await sidepanelPage.evaluate(async () => {
    const res = await fetch('https://example.com/test.bin', {
      credentials: 'include',
      headers: {
        Referer: 'https://www.bilibili.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    const blob = await res.blob()
    return blob.size
  })

  expect(size).toBe(payload.byteLength)
})
