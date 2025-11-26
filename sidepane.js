
class SidePaneController {
    constructor() {
        this.init()
    }

    init() {
        this.initButton()
    }

    initButton() {
        document.addEventListener('DOMContentLoaded', () => {
            // 设置消息监听
            chrome.runtime.onMessage.addListener((message) => {
                switch (message.type) {
                    case 'summarize:keepAlive':
                        this.handleSummarizeKeepAliveMessage(message.data)
                        break
                    case "assistant:keepAlive":
                        this.handleAssistantKeepAliveMessage(message.data)
                        break
                    default:
                        break
                }
            })
            document
                .getElementById("extract")
                .addEventListener("click", async () => {
                    await this.extract("srt")
                })
            document
                .getElementById("extract-only-text")
                .addEventListener("click", async () => {
                    await this.extract("md")
                })
            document.getElementById('summary').addEventListener('click', () => this.summarize())
            document.getElementById("assistant").addEventListener("click", () => this.assistant())
        })
    }

    async sendMessage(payload) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(payload, resolve)
        })
    }

    async summarize(requireDownload = false) {
        this.setMessage("正在使用AI处理字幕...")
        const res = this.sendMessage({
            type: "summarize",
        })
        if (res?.error) {
            this.setMessage(res.error)
            return
        }
        if (!requireDownload) {
            return
        }
        const textData = this.text2url(res.data, "md")
        const textFilePromise = this.downloadFile(
            textData.url,
            `${res.bvid}-${res.cid}-summary.md`
        )
        textFilePromise.finally(textData.destory)
        const downloadId = await textFilePromise
        this.setMessage(`总结完成，请查看下载的文件, ${downloadId}`)
    }

    async assistant() {
        this.setMessage("正在启动AI智能体...")
        await this.sendMessage({
            type: "startAssistant",
            payload: {
                message: "帮我做一个视频观看规划"
            }
        })
    }

    setMessage(msg) {
        document.getElementById("result-container").textContent = msg
    }

    async extract(mode = "srt") {
        this.setMessage("正在提取字幕...")
        const res = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    type: "fetchSubtitles",
                    payload: {
                        mode,
                    },
                },
                async (res) => resolve(res)
            )
        })
        if (res?.error) {
            this.setMessage(res.error)
            return
        }
        let downloadId = -1
        switch (mode) {
            case "md":
                const textData = this.text2url(res.data, mode)
                const textFilePromise = this.downloadFile(
                    textData.url,
                    `${res.bvid}-${res.cid}.md`
                )
                textFilePromise.finally(textData.destory)
                downloadId = await textFilePromise
                break
            case "srt":
                const srtData = this.text2url(res.data, mode)
                const srtFilePromise = this.downloadFile(
                    srtData.url,
                    `${res.bvid}-${res.cid}.srt`
                )
                srtFilePromise.finally(srtData.destory)
                downloadId = await srtFilePromise
                break
            default:
                break
        }
        this.afterDownload(downloadId)
    }

    text2url(text, fileType = "txt") {
        const fileType2MediaType = new Map([
            ["txt", "text/plain"],
            ["md", "text/markdown"],
            ["xmd", "text/x-markdown"],
            ["srt", "application/x-subrip"],
        ])
        const blob = new Blob([text], {
            type: fileType2MediaType.get(fileType),
        })
        const url = URL.createObjectURL(blob)
        return {
            url,
            destory: () => URL.revokeObjectURL(url),
        }
    }

    async downloadFile(url, filename) {
        return await chrome.downloads.download({
            url,
            filename,
            conflictAction: "uniquify",
            saveAs: false,
        })
    }

    afterDownload(id) {
        this.setMessage(`字幕提取完成:${id}`)
    }

    handleSummarizeKeepAliveMessage(data) {
        const resultContainer = document.getElementById('result-container')
        if (data.error) {
            this.setMessage(data.error)
            return
        }
        if (data.done && data.content) {
            this.showStreamResult(data.data)
            return
        }
        if (data.content) {
            resultContainer.innerHTML += data.content
        }
    }

    handleAssistantKeepAliveMessage(data) {
        const resultContainer = document.getElementById('result-container')
        if (data.error) {
            this.setMessage(data.error)
            return
        }
        if (data.done && data.content) {
            this.showStreamResult(data.data)
            return
        }
        if (data.content) {
            resultContainer.innerHTML += data.content
        }
    }

    showStreamResult(data) {
        const resultContainer = document.getElementById('result-container')
        // 简单markdown渲染
        resultContainer.innerHTML = data
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
    }
}

new SidePaneController()