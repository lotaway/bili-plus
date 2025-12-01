import { SubtitleFetcher } from './SubtitleFetcher';
import { StreamUtils } from '../utils/streamUtils';

export class AISubtitleHandler {
  isBusy = false;

  static defaultModelName() {
    return 'gpt-3.5-turbo';
  }

  get prompt() {
    return `你是一个学霸，能很好地发掘视频提供的知识，请将以下视频字幕内容进行总结和提炼：
1. 去除所有礼貌用语、空泛介绍、玩笑话、广告、评价和不客观的观点
2. 保留对核心问题的介绍、解析、可行方式、步骤和示例
3. 可以轻度补充缺失的内容
4. 输出为结构清晰的Markdown格式`;
  }

  async summarizeSubtitlesHandler(
    fetcher: SubtitleFetcher,
    onProgress?: (chunk: string) => void
  ) {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' };
    }
    const config = await chrome.storage.sync.get([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ]);
    if (!config.aiEndpoint) {
      return { error: '请先配置AI服务' };
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
        config,
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
    config: any,
    onProgress?: (chunk: string) => void
  ) {
    const completePrompt = `${this.prompt}

视频标题：${title}
字幕内容：
${text}`;
    const signal = AbortSignal.timeout(5 * 60 * 1000);
    const response = await fetch(`${config.aiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.aiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: config.aiModel ?? AISubtitleHandler.defaultModelName(),
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
