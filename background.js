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
                this.fetchSubtitles(request.msg, sendResponse)
                break
        }
    }

    async fetchSubtitles(msg, sendResponse) {
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
        let downloadId = -1
        switch (mode) {
            case "text":
                downloadId = await this.downloadFile(this.bilisub2text(subJson), `${match.bvid}.md`)
                break
            case "srt":
            default:
                downloadId = await this.downloadFile(this.bilisub2srt(subJson), `${match.bvid}.srt`)
                break
        }
        return sendResponse({ downloadId })
    }

    float2hhmmss(num) {
        const int_ = Number.parseInt(num)
        const frac = Number.parseInt((num - int_) * 1000)
        const hr = Math.floor(int_ / 3600)
        const min = Math.floor((int_ % 3600) / 60)
        const sec = int_ % 60
        return `${hr}:${String(min).padStart(2, "0")}:${String(sec).padStart(
            2,
            "0"
        )},${String(frac).padStart(3, "0")}`
    }

    bilisub2text(j) {
        return j.body.map((s) => s.content).join("\n\n")
    }

    bilisub2srt(j) {
        return j.body
            .map(
                (s, i) =>
                    `${i + 1}\n${this.float2hhmmss(
                        s.from
                    )} --> ${this.float2hhmmss(s.to)}\n${s.content}`
            )
            .join("\n\n")
    }

    async downloadSrt(srt, name, ext = "srt") {
        const blob = new Blob([srt], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${name}.${ext}`
        a.style.display = "none"
        document.documentElement.appendChild(a)
        requestAnimationFrame(() => {
            a.click()
            setTimeout(() => {
                a.remove()
                URL.revokeObjectURL(url)
            }, 3000)
        })
    }

    async downloadFile(url, filename) {
        return await chrome.downloads.download({
            url: url,
            filename,
            conflictAction: "uniquify",
            saveAs: false,
        })
    }
}

const downloadManager = new DownloadManager()
