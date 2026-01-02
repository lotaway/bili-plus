import { CompletionData } from "../types/CompletionData"


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
      const DATA_PREFIX = 'data: '
      for (const line of lines) {
        if (line.includes('[DONE]')) {
          break
        }
        if (!line.startsWith(DATA_PREFIX)) {
          continue
        }
        try {
          const data: CompletionData = JSON.parse(line.substring(DATA_PREFIX.length))
          const agentMetadata = data.agent_metadata
          const finishReason = data.choices[0]?.finish_reason
          const content = data.choices[0]?.delta?.content
          let metadata: any = null
          if (finishReason || agentMetadata) {
            metadata = { ...agentMetadata }
            if (finishReason) {
              metadata.finish_reason = finishReason
            }
          }
          if (!content && metadata) {
            onProgress?.('', metadata)
          }

          if (content) {
            fullResponse += content
            onProgress?.(content, metadata)
          }
        } catch (e) {
          console.error('Error parsing stream data:', e)
        }
      }
    }
    return fullResponse
  }
}
