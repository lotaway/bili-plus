import { SubtitleFetcher } from './SubtitleFetcher'
import { StreamUtils } from '../utils/streamUtils'

interface Config {
    aiProvider: string
    aiEndpoint: string
    aiKey: string
    aiModel: string
}

export class AISubtitleHandler {
  isBusy = false
  private apiCheckTimeout: number | null = null
  private config: Config | null = null
  private version = "v1"

  static defaultModelName() {
    return 'gpt-3.5-turbo'
  }

  initializeApiStatusCheck() {
    if (this.apiCheckTimeout) {
      clearTimeout(this.apiCheckTimeout)
    }
    this.scheduleApiCheck()
  }

  stopApiStatusCheck() {
    if (this.apiCheckTimeout) {
      clearTimeout(this.apiCheckTimeout)
      this.apiCheckTimeout = null
    }
  }

  private scheduleApiCheck() {
    this.apiCheckTimeout = setTimeout(() => {
      this.checkApiStatus()
    }, 5000)
  }

  private async checkApiStatus() {
    try {
      const signal = AbortSignal.timeout(5000)
      this.config = await chrome.storage.sync.get([
        'aiProvider',
        'aiEndpoint',
        'aiKey',
        'aiModel',
      ]) as Config
      if (!this.config.aiEndpoint) {
        return { error: '请先配置AI服务' }
      }
      const response = await fetch(`${this.config.aiEndpoint}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      const isApiOk = data?.ok === true
      await chrome.storage.local.set({
        apiStatus: {
          ok: isApiOk,
          lastChecked: new Date().toISOString(),
          message: isApiOk ? 'API服务正常' : 'API服务异常'
        }
      })
      console.log(`API状态检查: ${isApiOk ? '正常' : '异常'}`)
    } catch (error) {
      console.error('API状态检查失败:', error)
      await chrome.storage.local.set({
        apiStatus: {
          ok: false,
          lastChecked: new Date().toISOString(),
          message: `API检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      })
    } finally {
      this.scheduleApiCheck()
    }
  }

  get prompt() {
    return `你是一个学霸，能很好地发掘视频提供的知识，请将以下视频字幕内容进行总结和提炼：
1. 去除所有礼貌用语、空泛介绍、玩笑话、广告、评价和不客观的观点
2. 保留对核心问题的介绍、解析、可行方式、步骤和示例
3. 可以轻度补充缺失的内容
4. 输出为结构清晰的Markdown格式`
  }

  async summarizeSubtitlesHandler(
    fetcher: SubtitleFetcher,
    onProgress?: (chunk: string) => void
  ) {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' };
    }
    const subJson = await fetcher.getSubtitlesText();
    if (subJson.error) return subJson;

    const subtitles = fetcher.bilisub2text(subJson);
    const title = await fetcher.getTitle().catch(() => '');
    this.isBusy = true;
    try {
      const summary = await this.processWithAI(
        title,
        subtitles,
        onProgress
      );
      return { data: summary };
    } finally {
      this.isBusy = false;
    }
  }

  async processWithAI(
    title: string,
    text: string,
    onProgress?: (chunk: string) => void
  ) {
    const completePrompt = `${this.prompt}

视频标题：${title}
字幕内容：
${text}`;
    const signal = AbortSignal.timeout(5 * 60 * 1000);
    if (!this.config) {
      return { error: '请先配置AI服务' };
    }
    const response = await fetch(`${this.config.aiEndpoint}/${this.version}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.aiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: this.config.aiModel ?? AISubtitleHandler.defaultModelName(),
        messages: [
          {
            role: 'user',
            content: completePrompt,
          },
        ],
        temperature: 0.7,
        stream: true,
      }),
      signal,
    });

    if (!response.body) throw new Error('No response body');
    const reader = response.body.getReader();

    const fullResponse = await new StreamUtils().readStream(
      reader,
      (content, _metadata) => {
        if (content && onProgress) {
          onProgress(content);
        }
      }
    );
    const matchs = fullResponse.match(/```markdown([\s\S]+?)```/);
    return `# ${title}\n\n${matchs ? matchs[1] : fullResponse}`;
  }
}
