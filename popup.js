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
        this.setMessage("正在初始化...")
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
        this.setMessage("正在获取视频信息...")
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
        chrome.runtime.sendMessage(
            {
                type: "fetchSubtitles",
                payload: {
                    mode,
                },
            },
            (res) => {
                if (res?.error) {
                    alert(res.error)
                    return
                }
                this.afterDownload(res?.downloadId)
            }
        )
    }

    async afterDownload(id) {
        this.setMessage(`字幕提取完成:${id}`)
    }
}

new PopupController()
