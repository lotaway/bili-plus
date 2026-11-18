import { test, expect } from '@playwright/test'
import { DownloadUtils } from '../../src/utils/DownloadUtils'

test('DownloadUtils.downloadToBlob 分段取流且不使用 credentials: include（避免 CDN CORS/567）', async () => {
  const originalFetch = globalThis.fetch
  const payload = new Uint8Array([1, 2, 3, 4])
  let capturedInit: RequestInit | undefined

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init
    let sent = false
    return {
      ok: true,
      status: 206,
      body: {
        getReader: () => ({
          read: async () => {
            if (sent) return { done: true, value: undefined }
            sent = true
            return { done: false, value: payload }
          }
        })
      },
      headers: { get: () => 'bytes 0-3/4' }
    } as any
  }) as typeof fetch

  try {
    const blob = await new DownloadUtils().downloadToBlob('https://cdn.example.com/video.m4s')
    expect(blob.size).toBe(payload.byteLength)

    const headers = capturedInit?.headers as Record<string, string> | undefined
    // 取流 URL 已带签名，不能带 Cookie：海外 CDN 常返回 `ACAO: *` 或空 `ACAC`，
    // include 模式会被 CORS 拦截并报 "Failed to fetch"。
    expect(capturedInit?.credentials).not.toBe('include')
    expect(capturedInit?.credentials).toBe('omit')
    // 播放器按 Range 取流；一次请求完整文件在海外 CDN 会被拒绝（HTTP 567）。
    expect(headers?.['Range']).toMatch(/^bytes=0-\d+$/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
