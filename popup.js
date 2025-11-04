class PopupController {
    #videoInfo = {
        isInit: false,
        aid: null,
        cid: null,
    }

    constructor() {
        this.initEventHandle()
        this.initButton()
    }

    initEventHandle() {
        document.addEventListener("RequestVideoInfo", async (event) => {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            })
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id,
                },
                files: ["page_inject.js"],
                world: "MAIN",
            })
        })
        document.addEventListener("VideoInfoUpdate", (event) => {
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

    async extract(mode = "srt") {
        document.getElementById("msg").textContent = "正在提取字幕..."
        let aid = this.#videoInfo.aid
        let cid = this.#videoInfo.cid
        if (!cid || !aid) {
            if (this.#videoInfo.isInit) {
                alert("视频信息获取失败，请刷新页面重试")
            } else {
                alert("content.js maybe not trigger")
            }
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
        document.getElementById("msg").textContent = `字幕提取完成:${id}`
    }
}

new PopupController()
