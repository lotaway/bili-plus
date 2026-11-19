import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import Logger from './Logger'

export class FFmpegUtils {
  private ffmpeg: FFmpeg
  private loaded: boolean = false

  constructor() {
    this.ffmpeg = new FFmpeg()
  }

  async load(classWorkerURL?: string): Promise<void> {
    if (this.loaded) return

    // 必须用 ESM core：FFmpeg 的 worker 是 module worker，无法用 importScripts 加载
    // UMD core，而 UMD 脚本通过 import() 又拿不到 default 导出，会报
    // "failed to import ffmpeg-core.js" / "network error"。
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
    this.ffmpeg.on('log', ({ message }) => {
      Logger.D('[FFmpeg]', message)
    })
    try {
      await this.ffmpeg.load({
        // 页面上下文不能从 bilibili.com 构造 chrome-extension:// 的 Worker，
        // 调用方会传入由扩展资源转成的 blob URL。
        ...(classWorkerURL ? { classWorkerURL } : {}),
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      this.loaded = true
      Logger.D('FFmpeg loaded successfully')
    } catch (error) {
      Logger.E('Failed to load FFmpeg:', error)
      throw error
    }
  }

  async mergeVideoAudio(videoBlob: Blob, audioBlob: Blob, classWorkerURL?: string): Promise<Blob> {
    if (!this.loaded) {
      await this.load(classWorkerURL)
    }

    try {
      const videoArrayBuffer = await videoBlob.arrayBuffer()
      await this.ffmpeg.writeFile('input_video.mp4', new Uint8Array(videoArrayBuffer))
      const audioArrayBuffer = await audioBlob.arrayBuffer()
      await this.ffmpeg.writeFile('input_audio.m4a', new Uint8Array(audioArrayBuffer))
      await this.ffmpeg.exec([
        '-i', 'input_video.mp4',
        '-i', 'input_audio.m4a',
        '-c', 'copy', // 直接复制流，不重新编码
        '-shortest',  // 以最短的流为准
        'output.mp4'
      ])
      const data = await this.ffmpeg.readFile('output.mp4')
      await this.ffmpeg.deleteFile('input_video.mp4')
      await this.ffmpeg.deleteFile('input_audio.m4a')
      await this.ffmpeg.deleteFile('output.mp4')
      const dataArray = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string)
      return new Blob([dataArray as any], { type: 'video/mp4' })
    } catch (error) {
      Logger.E('FFmpeg merge failed:', error)
      try {
        await this.ffmpeg.deleteFile('input_video.mp4')
        await this.ffmpeg.deleteFile('input_audio.m4a')
        await this.ffmpeg.deleteFile('output.mp4')
      } catch (cleanupError) {
        Logger.E('Failed to cleanup FFmpeg files:', cleanupError)
      }

      throw error
    }
  }

  async extractAudio(videoBlob: Blob, classWorkerURL?: string): Promise<Blob> {
    if (!this.loaded) {
      await this.load(classWorkerURL)
    }

    try {
      const videoArrayBuffer = await videoBlob.arrayBuffer()
      await this.ffmpeg.writeFile('input_video.mp4', new Uint8Array(videoArrayBuffer))

      await this.ffmpeg.exec([
        '-i', 'input_video.mp4',
        '-vn', // 不包含视频
        '-acodec', 'copy', // 复制音频编码
        'output_audio.m4a'
      ])

      const data = await this.ffmpeg.readFile('output_audio.m4a')

      await this.ffmpeg.deleteFile('input_video.mp4')
      await this.ffmpeg.deleteFile('output_audio.m4a')

      const dataArray = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string)
      return new Blob([dataArray as any], { type: 'audio/mp4' })
    } catch (error) {
      Logger.E('FFmpeg audio extraction failed:', error)
      throw error
    }
  }

  async convertToMp4(videoBlob: Blob, classWorkerURL?: string): Promise<Blob> {
    if (!this.loaded) {
      await this.load(classWorkerURL)
    }

    try {
      const videoArrayBuffer = await videoBlob.arrayBuffer()
      await this.ffmpeg.writeFile('input_video', new Uint8Array(videoArrayBuffer))

      await this.ffmpeg.exec([
        '-i', 'input_video',
        '-c', 'copy',
        'output.mp4'
      ])

      const data = await this.ffmpeg.readFile('output.mp4')

      await this.ffmpeg.deleteFile('input_video')
      await this.ffmpeg.deleteFile('output.mp4')

      const dataArray = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string)
      return new Blob([dataArray as any], { type: 'video/mp4' })
    } catch (error) {
      Logger.E('FFmpeg conversion failed:', error)
      throw error
    }
  }
}
