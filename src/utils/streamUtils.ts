export class StreamUtils {
  async readStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onProgress: (content: string, metadata: any) => void = (c, m) =>
      console.debug('Content:', c, 'Metadata:', m),
    encoding: string = 'utf-8'
  ): Promise<string> {
    const decoder = new TextDecoder(encoding)
    let buffer = ''
    let fullResponse = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const SPLIT = '\n'
      const lines = buffer.split(SPLIT)
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data:') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.substring(5))
            const agentMetadata = data.agent_metadata
            onProgress?.('', agentMetadata)
            const content = data.choices[0]?.delta?.content
            if (content) {
              fullResponse += content
              onProgress?.(content, null)
            }
          } catch (e) {
            console.error('Error parsing stream data:', e)
          }
        }
      }
    }
    return fullResponse
  }
}
