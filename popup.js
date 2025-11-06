class PopupController {
    constructor() {
        void this.init()
    }

    async init() {
        this.initEventHandle().catch((err) => {
            console.error(err)
        })
        this.initButton()
        this.loadConfig()
    }

    async initEventHandle() {
        // this.setMessage("正在初始化...")
        // const [tab] = await chrome.tabs.query({
        //     active: true,
        //     currentWindow: true,
        // })
        // await chrome.scripting.executeScript({
        //     target: {
        //         tabId: tab.id,
        //     },
        //     files: ["utils/video_page_inject.js"],
        //     world: "MAIN",
        // })
        // this.setMessage("正在获取视频信息...")
    }

    async loadConfig() {
        const config = await chrome.storage.sync.get([
            "aiProvider",
            "aiEndpoint",
            "aiKey",
            "aiModel",
        ])

        document.getElementById("aiProvider").value = config.aiProvider || ""
        document.getElementById("aiEndpoint").value = config.aiEndpoint || ""
        document.getElementById("aiKey").value = config.aiKey || ""
        document.getElementById("aiModel").value =
            config.aiModel || "gpt-3.5-turbo"
    }

    initButton() {
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

        document
            .getElementById("saveConfig")
            .addEventListener("click", async () => {
                await this.saveConfig()
            })

        document
            .getElementById("summary")
            .addEventListener("click", async () => {
                await this.summarize()
            })
    }

    async saveConfig() {
        const provider = document.getElementById("aiProvider").value
        const endpoint = document.getElementById("aiEndpoint").value
        const key = document.getElementById("aiKey").value
        const model = document.getElementById("aiModel").value

        await chrome.storage.sync.set({
            aiProvider: provider,
            aiEndpoint: endpoint,
            aiKey: key,
            aiModel: model,
        })

        this.setMessage("配置已保存")
    }

    async summarize() {
        this.setMessage("正在使用AI处理字幕...")
        const res = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    type: "summarize",
                    payload: {
                        mode: "md",
                    },
                },
                async (res) => resolve(res)
            )
        })
        if (res?.error) {
            this.setMessage(res.error)
            return
        }
        const textData = this.text2url(res.data, mode)
        const textFilePromise = this.downloadFile(
            textData.url,
            `${res.bvid}-${res.cid}-summary.md`
        )
        textFilePromise.finally(textData.destory)
        const downloadId = await textFilePromise
        setTimeout(() => {
            this.setMessage(`总结完成，请查看下载的文件, ${downloadId}`)
        }, 2000)
    }

    setMessage(msg) {
        document.getElementById("msg").textContent = msg
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
}

new PopupController()
