import { ParsingState } from "../enums/ParseState"

type Subscriber = (data: { done: boolean, think: string, content: string }) => void

export class AIGenerationAnalyzer {

    private state: ParsingState = ParsingState.FREE
    public START_THINK_TAG = '<think>'
    public END_THINK_TAG = '</think>'
    public START_MARKDOWN_TAG = '```markdown'
    public END_MARKDOWN_TAG = '```'
    public END_OF_SENTENCE = '<｜end▁of▁sentence｜>'
    private think: string = ''
    private content: string = ''
    private handeTimer?: number
    private streaming: boolean = false
    private subscribers: Map<string, Subscriber> = new Map()

    constructor(private buffer: string = '', private readonly withFrame = false) {

    }

    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    inputStream(chunk: string, isDone?: boolean) {
        this.buffer += chunk
        if (this.subscribers.size === 0 || this.streaming)
            return
        if (this.withFrame) {
            this.handeTimer && globalThis.cancelAnimationFrame(this.handeTimer)
            this.handeTimer = globalThis.requestAnimationFrame(() => {
                if (this.streaming)
                    return
                this.handeTimer = undefined
                this.outputStream()
            })
        }
        else if (this.streaming) {
            return
        }
        this.outputStream(isDone)
    }

    outputStream(isDone?: boolean) {
        this.streaming = true
        try {
            const thinkBefore = this.think
            const contentBefore = this.content
            if (this.state === ParsingState.FREE) {
                this.state = ParsingState.GENERATING
            }

            while (this.buffer.length > 0) {
                if (this.state === ParsingState.GENERATING) {
                    const possibleThinkStart = this.checkPartialStartTag(this.START_THINK_TAG)
                    const possibleMarkdownStart = this.checkPartialStartTag(this.START_MARKDOWN_TAG)
                    const possibleThinkEnd = this.checkPartialEndTag(this.END_THINK_TAG)
                    const possibleMarkdownEnd = this.checkPartialEndTag(this.END_MARKDOWN_TAG)
                    if (possibleThinkStart || possibleMarkdownStart || possibleThinkEnd || possibleMarkdownEnd) {
                        break
                    }

                    const thinkingStartIndex = this.buffer.indexOf(this.START_THINK_TAG)
                    const thinkingEndIndex = this.buffer.indexOf(this.END_THINK_TAG)
                    const markdownStartIndex = this.buffer.indexOf(this.START_MARKDOWN_TAG)
                    if (thinkingEndIndex !== -1 && thinkingStartIndex === -1) {
                        const contentBeforeEnd = this.buffer.substring(0, thinkingEndIndex)
                        this.think += (this.content + contentBeforeEnd)
                        this.content = ''
                        this.state = ParsingState.GENERATING
                        this.buffer = this.buffer.substring(thinkingEndIndex + this.END_THINK_TAG.length)
                        continue
                    }
                    if (thinkingStartIndex !== -1 && (markdownStartIndex === -1 || thinkingStartIndex < markdownStartIndex)) {
                        if (thinkingStartIndex > 0) {
                            this.content += this.buffer.substring(0, thinkingStartIndex)
                        }
                        this.state = ParsingState.THINKING
                        this.buffer = this.buffer.substring(thinkingStartIndex + this.START_THINK_TAG.length)
                        continue
                    }
                    if (markdownStartIndex !== -1) {
                        if (markdownStartIndex > 0) {
                            this.content += this.buffer.substring(0, markdownStartIndex)
                        }
                        this.state = ParsingState.CONTENTING
                        this.buffer = this.buffer.substring(markdownStartIndex + this.START_MARKDOWN_TAG.length)
                        continue
                    }

                    this.content += this.buffer
                    this.buffer = ''
                }
                else if (this.state === ParsingState.THINKING) {
                    const possibleThinkEnd = this.checkPartialEndTag(this.END_THINK_TAG)
                    if (possibleThinkEnd) {
                        break
                    }

                    const thinkingEnd = this.buffer.indexOf(this.END_THINK_TAG)
                    if (thinkingEnd !== -1) {
                        this.think += this.buffer.substring(0, thinkingEnd)
                        this.state = ParsingState.GENERATING
                        this.buffer = this.buffer.substring(thinkingEnd + this.END_THINK_TAG.length)
                    } else {
                        this.think += this.buffer
                        this.buffer = ''
                    }
                }
                else if (this.state === ParsingState.CONTENTING) {
                    const possibleMarkdownEnd = this.checkPartialEndTag(this.END_MARKDOWN_TAG)
                    if (possibleMarkdownEnd) {
                        break
                    }

                    const markdownEnd = this.buffer.indexOf(this.END_MARKDOWN_TAG)
                    if (markdownEnd !== -1) {
                        this.content += this.buffer.substring(0, markdownEnd)
                        this.state = ParsingState.FREE
                        this.buffer = this.buffer.substring(markdownEnd + this.END_MARKDOWN_TAG.length)
                    } else {
                        this.content += this.buffer
                        this.buffer = ''
                    }
                }
            }

            const done = isDone ?? this.state === ParsingState.FREE
            const newThink = this.think.substring(thinkBefore.length)
            const newContent = this.content.substring(contentBefore.length)
            if (newThink || newContent || done) {
                this.subscribers.forEach(subscriber => {
                    subscriber({
                        done,
                        think: this.think,
                        content: done ? this.content : newContent,
                    })
                })
            }
        } finally {
            this.streaming = false
        }
    }

    private checkPartialStartTag(tag: string): boolean {
        if (this.buffer.length >= tag.length) return false
        return tag.startsWith(this.buffer)
    }

    private checkPartialEndTag(tag: string): boolean {
        if (this.buffer.length >= tag.length) return false
        return tag.startsWith(this.buffer)
    }

    subscribe(subscriber: Subscriber): string {
        const id = this.generateSubscriptionId()
        this.subscribers.set(id, subscriber)
        return id
    }

    unsubscribe(id: string): boolean {
        return this.subscribers.delete(id)
    }

    reset() {
        this.state = ParsingState.FREE
        this.buffer = ''
        this.think = ''
        this.content = ''
        this.streaming = false
        this.handeTimer && globalThis.cancelAnimationFrame(this.handeTimer)
    }

    analyze(buffer: string = this.buffer) {
        let think = ''
        let remaining = buffer

        const thinkMatch = new RegExp(`${this.START_THINK_TAG}([\\s\\S]+?)${this.END_THINK_TAG}`).exec(buffer)
        if (thinkMatch) {
            think = thinkMatch[1].trim()
            remaining = buffer.substring(thinkMatch.index + thinkMatch[0].length)
        } else {
            const thinkEndIndex = buffer.indexOf(this.END_THINK_TAG)
            if (thinkEndIndex !== -1) {
                think = buffer.substring(0, thinkEndIndex).trim()
                remaining = buffer.substring(thinkEndIndex + this.END_THINK_TAG.length)
            }
        }

        const markdownMatch = new RegExp(`${this.START_MARKDOWN_TAG}([\\s\\S]+?)${this.END_MARKDOWN_TAG}`).exec(remaining)
        let content = ''

        if (markdownMatch) {
            content = markdownMatch[1].trim()
        } else {
            content = remaining.trim()
        }

        content = content.replace(new RegExp(`${this.END_OF_SENTENCE}$`), '')

        return {
            think,
            content,
        }
    }
}