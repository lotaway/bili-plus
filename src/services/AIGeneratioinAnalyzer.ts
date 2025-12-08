
export class AIGenerationAnalyzer {

    private think: string = ''
    private content: string = ''

    constructor(private buffer: string = '') {

    }

    inputStream(chunk: string) {
        this.buffer += chunk
        this.outputStream()
    }

    outputStream() {
        // @TODO analyze buffer when get input stream
    }

    analyze() {
        const think = new RegExp(/^(<think>)?[\s\S]*?<\/think>\s*/).exec(this.buffer)
        const output = this.buffer.replace(/^(<think>)?[\s\S]*?<\/think>\s*/, '')
        const matchs = new RegExp(/```markdown([\s\S]+?)```/).exec(output)
        const cleanContent = (matchs?.[1] ?? output).replace(/<｜end▁of▁sentence｜>$/, '')
        return {
            think: think?.[0] ?? '',
            content: cleanContent,
        }
    }
}