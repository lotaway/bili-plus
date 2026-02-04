import { test, expect } from '@playwright/test'
import { selectAudioStream, selectVideoStream } from '../../src/services/StreamSelector'

test('选择H.264视频流优先', async () => {
  const streams = [
    { mimeType: 'video/mp4', codecs: 'avc1.640028', bandwidth: 1500000, baseUrl: 'v-avc1' },
    { mimeType: 'video/mp4', codecs: 'av01.0.05M.08', bandwidth: 3000000, baseUrl: 'v-av1' },
    { mimeType: 'video/mp4', codecs: 'hev1.1.6.L120', bandwidth: 2500000, baseUrl: 'v-hevc' }
  ]
  const v = selectVideoStream(streams as any)
  expect(v.baseUrl).toBe('v-avc1')
})

test('无H.264时选择最高码率', async () => {
  const streams = [
    { mimeType: 'video/mp4', codecs: 'av01.0.05M.08', bandwidth: 3000000, baseUrl: 'v-av1' },
    { mimeType: 'video/mp4', codecs: 'hev1.1.6.L120', bandwidth: 3500000, baseUrl: 'v-hevc' }
  ]
  const v = selectVideoStream(streams as any)
  expect(v.baseUrl).toBe('v-hevc')
})

test('选择AAC音频流优先', async () => {
  const streams = [
    { mimeType: 'audio/mp4', codecs: 'mp4a.40.2', bandwidth: 128000, baseUrl: 'a-aac' },
    { mimeType: 'audio/eac3', codecs: 'ec-3', bandwidth: 256000, baseUrl: 'a-dolby' },
    { mimeType: 'audio/flac', codecs: 'flac', bandwidth: 512000, baseUrl: 'a-flac' }
  ]
  const a = selectAudioStream(streams as any)
  expect(a.baseUrl).toBe('a-aac')
})

test('无AAC时选择最高码率音频', async () => {
  const streams = [
    { mimeType: 'audio/eac3', codecs: 'ec-3', bandwidth: 256000, baseUrl: 'a-dolby' },
    { mimeType: 'audio/flac', codecs: 'flac', bandwidth: 512000, baseUrl: 'a-flac' }
  ]
  const a = selectAudioStream(streams as any)
  expect(a.baseUrl).toBe('a-flac')
})
