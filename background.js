class DownloadManager {
    constructor() {
        this.setupEventListeners()
    }

    setupEventListeners() {
        chrome.downloads.onChanged.addListener(
            this.onDownloadChanged.bind(this)
        )
        chrome.downloads.onCreated.addListener(
            this.onDownloadCreated.bind(this)
        )
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    }

    onDownloadChanged(args) {
        console.log(`Download changed: ${args}`)
    }

    onDownloadCreated(args) {
        console.log(`Download created: ${args}`)
    }

    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case "fetchSubtitles":
            default:
                this.fetchSubtitles(request.msg, request.options)
                break
        }
    }

    async fetchSubtitles(msg) {
        const { aid, cid } = msg
        const cookieStore = await chrome.cookies.getAll({
            domain: ".bilibili.com",
        })
        const cookieHeader = cookieStore
            .map((c) => `${c.name}=${c.value}`)
            .join("; ")
        const url = `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`
        const headers = { Cookie: cookieHeader }
        const j = await fetch(url, { headers }).then((r) => r.json())
        const subtitles = j?.data?.subtitle?.subtitles || []
        const pref = subtitles.find((s) =>
            ["ai-zh", "zh", "zh-CN"].includes(s.lan)
        )
        if (!pref) return sendResponse({ error: "无可用字幕" })
        const subUrl = "https:" + pref.subtitle_url
        const subJson = await fetch(subUrl, { headers }).then((r) => r.json())
        const downloadId = await chrome.downloads.download({
            url: imageUrl,
            filename: filename,
            conflictAction: "uniquify",
            saveAs: false,
        })
        sendResponse({ subJson })
    }
}

const downloadManager = new DownloadManager()
