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

    constructor(private buffer: string = '') {

    }

    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    inputStream(chunk: string) {
        this.buffer += chunk
        if (this.subscribers.size === 0 || this.streaming)
            return
        this.handeTimer && globalThis.cancelAnimationFrame(this.handeTimer)
        this.handeTimer = globalThis.requestAnimationFrame(() => {
            if (this.streaming)
                return
            this.handeTimer = undefined
            this.outputStream()
        })
    }

    outputStream() {
        this.streaming = true
        try {
            while (this.buffer.length > 0) {
                if (this.state === ParsingState.FREE) {
                    let thinkingStartIndex = this.buffer.indexOf(this.START_THINK_TAG)
                    const thinkingEndIndex = this.buffer.indexOf(this.END_THINK_TAG)

                    if (thinkingEndIndex !== -1 && (thinkingStartIndex === -1 || thinkingEndIndex < thinkingStartIndex)) {
                        thinkingStartIndex = 0
                        const contentBefore = this.buffer.substring(thinkingStartIndex, thinkingEndIndex)
                        this.think += (this.content + contentBefore)
                        this.content = ''
                        this.buffer = this.buffer.substring(thinkingEndIndex + this.END_THINK_TAG.length)
                        continue
                    }
                    const markdownStartIndex = this.buffer.indexOf(this.START_MARKDOWN_TAG)
                    if (thinkingStartIndex !== -1 && (markdownStartIndex === -1 || thinkingStartIndex < markdownStartIndex)) {
                        this.state = ParsingState.THINKING
                        this.buffer = this.buffer.substring(thinkingStartIndex + this.START_THINK_TAG.length)
                    } else if (markdownStartIndex !== -1) {
                        this.state = ParsingState.GENERATING
                        this.buffer = this.buffer.substring(markdownStartIndex + this.START_MARKDOWN_TAG.length)
                    } else {
                        this.content += this.buffer
                        this.buffer = ''
                    }
                }
                if (this.state === ParsingState.THINKING) {
                    const thinkingEnd = this.buffer.indexOf(this.END_THINK_TAG)
                    if (thinkingEnd !== -1) {
                        this.think += this.buffer.substring(0, thinkingEnd)
                        this.state = ParsingState.FREE
                        this.buffer = this.buffer.substring(thinkingEnd + this.END_THINK_TAG.length)
                    } else {
                        this.think += this.buffer
                        this.buffer = ''
                    }
                }
                if (this.state === ParsingState.GENERATING) {
                    const markdownEnd = this.buffer.indexOf(this.END_MARKDOWN_TAG)
                    if (markdownEnd !== -1) {
                        this.think += this.buffer.substring(0, markdownEnd)
                        this.state = ParsingState.FREE
                        this.content += this.buffer.substring(markdownEnd + this.END_MARKDOWN_TAG.length)
                    } else {
                        this.content += this.buffer
                        this.buffer = ''
                    }
                }
            }
            this.subscribers.forEach(subscriber => {
                subscriber({
                    done: this.buffer.length === 0 && this.state === ParsingState.FREE,
                    think: this.think,
                    content: this.content,
                })
            })
        } finally {
            this.streaming = false
        }
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
        this.subscribers.clear()
        this.subscribers = new Map()
        this.state = ParsingState.FREE
        this.buffer = ''
        this.think = ''
        this.content = ''
        this.streaming = false
        this.handeTimer && globalThis.cancelAnimationFrame(this.handeTimer)
    }

    analyze(buffer: string = this.buffer) {
        const exp = new RegExp(`^(${this.START_THINK_TAG})?[\\s\\S]*?${this.END_THINK_TAG}\\s*`)
        const think = exp.exec(buffer)
        const output = buffer.replace(exp, '')
        const matchs = new RegExp(`${this.START_MARKDOWN_TAG}([\\s\\S]+?)${this.END_MARKDOWN_TAG}`).exec(output)
        const cleanContent = (matchs?.[1] ?? output).replace(new RegExp(`${this.END_OF_SENTENCE}$`), '')
        return {
            think: think?.[0] ?? '',
            content: cleanContent,
        }
    }
}