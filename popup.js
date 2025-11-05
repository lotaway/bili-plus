class PopupController {
    constructor() {
        void this.init()
    }

    async init() {
        this.initEventHandle().catch((err) => {
            console.error(err)
        })
        this.initButton()
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

    initButton() {
        document
            .getElementById("extract")
            .addEventListener("click", async () => {
                await this.extract("srt")
            })

        document
            .getElementById("extract-only-text")
            .addEventListener("click", async () => {
                await this.extract("text")
            })
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
            case "text":
                const textData = this.text2url(res.data)
                const textFilePromise = this.downloadFile(
                    textData.url,
                    `${res.bvid}.md`
                )
                textFilePromise.finally(textData.destory)
                downloadId = await textFilePromise
                break
            case "srt":
                const srtData = this.text2url(res.data)
                const srtFilePromise = this.downloadFile(
                    srtData.url,
                    `${res.bvid}.srt`
                )
                srtFilePromise.finally(srtData.destory)
                downloadId = await srtFilePromise
                break
            default:
                break
        }
        this.afterDownload(downloadId)
    }

    text2url(text) {
        const blob = new Blob([text], { type: "text/plain" })
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
