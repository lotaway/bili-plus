export type DashVideo = {
  mimeType?: string
  mime_type?: string
  codecs?: string
  bandwidth: number
  baseUrl: string
}

export type DashAudio = {
  mimeType?: string
  mime_type?: string
  codecs?: string
  bandwidth: number
  baseUrl: string
}

export function selectVideoStream(streams: DashVideo[]): DashVideo {
  const prefer = (v: DashVideo) => {
    const mime = v.mimeType || v.mime_type || ''
    const codecs = v.codecs || ''
    return mime.includes('video/mp4') && codecs.toLowerCase().includes('avc1')
  }
  return streams.find(prefer) || streams.sort((a, b) => b.bandwidth - a.bandwidth)[0]
}

export function selectAudioStream(streams: DashAudio[]): DashAudio {
  const prefer = (a: DashAudio) => {
    const mime = a.mimeType || a.mime_type || ''
    const codecs = a.codecs || ''
    return mime.includes('audio/mp4') && codecs.toLowerCase().includes('mp4a')
  }
  return streams.find(prefer) || streams.sort((a, b) => b.bandwidth - a.bandwidth)[0]
}
