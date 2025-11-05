class PopupController {
    #videoInfo = {
        isInit: false,
        aid: null,
        cid: null,
    }

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
        this.setMessage("正在获取视频信息...")
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        })
        await chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
            },
            files: ["utils/page_inject.js"],
            world: "MAIN",
        })
        document.addEventListener("VideoInfoUpdate", (event) => {
            this.setMessage("视频信息获取成功")
            const { aid, cid } = event.detail
            this.#videoInfo = { isInit: true, aid, cid }
        })
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
        let aid = this.#videoInfo.aid
        let cid = this.#videoInfo.cid
        if (!cid || !aid) {
            if (this.#videoInfo.isInit) {
                this.setMessage("视频信息获取失败，请刷新页面重试")
            } else {
                this.setMessage("content.js maybe not trigger")
            }
            return
        }
        chrome.runtime.sendMessage(
            {
                type: "fetchSubtitles",
                msg: {
                    aid,
                    cid,
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
