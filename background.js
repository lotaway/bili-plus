class DownloadManager {
    #videoInfo = {
        isInit: false,
        aid: null,
        cid: null,
    }

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
        console.debug(`Download changed: ${args}`)
    }

    onDownloadCreated(args) {
        console.debug(`Download created: ${args}`)
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case "fetchSubtitles":
                message.payload.aid = message.payload.aid ?? this.#videoInfo.aid
                message.payload.cid = message.payload.cid ?? this.#videoInfo.cid
                if (!message.payload.cid || !message.payload.aid) {
                    if (this.#videoInfo.isInit) {
                        this.setMessage("视频信息获取失败，请刷新页面重试")
                    } else {
                        this.setMessage("content.js maybe not trigger")
                    }
                    return
                }
                this.#videoInfo.aid = message.payload.aid
                this.#videoInfo.cid = message.payload.cid
                this.fetchSubtitles(message.payload, sendResponse)
                return true
            case "summarize":
                this.summarizeSubtitles(message.payload, sendResponse)
                return true
            case "VideoInfoUpdate":
                this.setMessage("视频信息获取成功")
                const { aid, cid } = message.payload
                this.#videoInfo = { isInit: true, aid, cid }
                break
            default:
                break
        }
    }

    async summarizeSubtitles(payload, sendResponse) {
        try {
            const config = await chrome.storage.sync.get([
                'aiProvider', 
                'aiEndpoint',
                'aiKey',
                'aiModel'
            ])
            
            if (!config.aiKey || !config.aiEndpoint) {
                return sendResponse({ error: "请先配置AI服务" })
            }

            const subtitles = await this.getSubtitlesText(payload)
            if (subtitles.error) {
                return sendResponse({ error: subtitles.error })
            }

            const summary = await this.processWithAI(subtitles, config)
            
            const downloadId = await this.downloadFile(
                summary,
                `${payload.bvid || 'summary'}_processed.md`
            )
            
            return sendResponse({ downloadId })
        } catch (error) {
            console.error("Summarize error:", error)
            return sendResponse({ error: "AI处理失败: " + error.message })
        }
    }

    async processWithAI(text, config) {
        const prompt = `请将以下视频字幕内容进行总结和提炼：
1. 去除所有礼貌用语、介绍、玩笑话、广告、评价和不客观的观点
2. 保留对核心问题的介绍、解析、可行方式、步骤和示例
3. 可以轻度补充缺失的内容
4. 输出为结构清晰的Markdown格式

字幕内容：
${text}`

        const response = await fetch(`${config.aiEndpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.aiKey}`
            },
            body: JSON.stringify({
                model: config.aiModel || "gpt-3.5-turbo",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7
            })
        })

        const data = await response.json()
        return data.choices[0].message.content
    }

    async getSubtitlesText(payload) {
        const { aid, cid } = payload
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
        if (!pref) return { error: "无可用字幕" }
        const subUrl = "https:" + pref.subtitle_url
        const subJson = await fetch(subUrl, { headers }).then((r) => r.json())
        return this.bilisub2text(subJson)
    }

    async fetchSubtitles(payload, sendResponse) {
        const { aid, cid, mode = "srt" } = payload
        const subtitles = await this.getSubtitlesText(payload)
        if (subtitles.error) {
            return sendResponse({ error: subtitles.error })
        }

        let downloadId = -1
        switch (mode) {
            case "text":
                downloadId = await this.downloadFile(
                    subtitles,
                    `${payload.bvid || 'subtitles'}.md`
                )
                break
            case "srt":
            default:
                const subJson = await this.getSubtitlesJson(payload)
                downloadId = await this.downloadFile(
                    this.bilisub2srt(subJson),
                    `${payload.bvid || 'subtitles'}.srt`
                )
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
