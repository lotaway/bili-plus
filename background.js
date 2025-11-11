// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'

class DownloadManager {
    #subtitleFetcher = new SubtitleFetcher()
    #aiSubtitleHandler = new AISubtitleHandler()

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

    checkVideoInfo() {
        if (!this.#subtitleFetcher.cid || !this.#subtitleFetcher.aid) {
            let msg = "视频信息获取失败，请刷新页面重试"
            if (!this.#subtitleFetcher.isInit) {
                msg = "content.js maybe not trigger"
            }
            return {
                isOk: false,
                error: msg,
            }
        }
        return {
            isOk: true,
        }
    }

    /**
     * handle income message
     * @param {Object} message 
     * @param {Object} sender 
     * @param {Function} sendResponse 
     * @returns {Boolean | undefined}
     */
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case "fetchSubtitles":
                {
                    const preResult = this.checkVideoInfo()
                    if (preResult?.error) {
                        return sendResponse(preResult)
                    }
                    this.#subtitleFetcher
                        .fetchSubtitlesHandler(message.payload)
                        .then((subtitleResult) => {
                            sendResponse({
                                data: subtitleResult,
                                bvid: this.#subtitleFetcher.bvid,
                                cid: this.#subtitleFetcher.cid,
                            })
                        })
                        .catch((error) => {
                            console.error(error)
                            sendResponse({
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : JSON.stringify(error),
                            })
                        })
                    return true
                }
            case "summarize":
                {
                    const preResult = this.checkVideoInfo()
                    if (preResult?.error) {
                        return sendResponse(preResult)
                    }
                    this.#aiSubtitleHandler
                        .summarizeSubtitlesHandler(this.#subtitleFetcher)
                        .then((summaryResult) => {
                            sendResponse({
                                ...summaryResult,
                                bvid: this.#subtitleFetcher.bvid,
                                cid: this.#subtitleFetcher.cid,
                            })
                        })
                        .catch((error) => {
                            console.error(error)
                            sendResponse({
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : JSON.stringify(error),
                            })
                        })
                    return true
                }
            case "VideoInfoUpdate":
                this.#subtitleFetcher.init(message.payload)
                break
            default:
                break
        }
    }
}

class BilibiliApi {
    #host = ""
    constructor(host = "https://api.bilibili.com") {
        this.#host = host
    }

    /**
     * 
     * @returns {Promise<Array>}
     */
    async getCookies() {
        return await chrome.cookies.getAll({
            domain: this.#host.replace("https://api", ""),
        })
    }

    /**
     * 
     * @param {Array} cookies 
     * @returns {string}
     */
    buildCookieHeader(cookies) {
        return cookies.map((c) => `${c.name}=${c.value}`)
            .join("; ")
    }

    /**
     * 
     * @param {string} cookies 
     * @returns {headers}
     */
    buildHeader(cookies) {
        return { Cookie: cookies }
    }

    /**
     * 
     * @param {Headers | undefined} headers 
     * @returns {Promise<Headers>}
     */
    async fillHeader(headers) {
        if (!headers) {
            const cookieHeader = this.buildCookieHeader(await this.getCookies())
            headers = this.buildHeader(cookieHeader)
        }
        return headers
    }

    /**
     * 
     * @param {string} bvid 
     * @param {Headers | undefined} headers 
     * @returns 
     */
    async getVideoInfo(bvid, headers) {
        headers = await this.fillHeader(headers)
        const url = `${this.#host}/x/web-interface/view?bvid=${bvid
            }`
        return await fetch(url, { headers }).then((r) => r.json())
    }

    /**
     * get video detail info
     * @param {string} aid 
     * @param {string} cid 
     * @param {Headers | undefined} headers 
     * @returns {Promise<JSON>}
     */
    async getVideoDetailInfo(aid, cid, headers) {
        headers = await this.fillHeader(headers)
        const url = `${this.#host}/x/player/wbi/v2?aid=${aid
            }&cid=${cid}`
        return await fetch(url, { headers }).then((r) => r.json())
    }

    /**
     * get video subtitle info (by call `getVideoDetailInfo`)
     * @param {string} aid 
     * @param {string} cid 
     * @returns {Promise<Array>}
     */
    async getVideoSubtitle(aid, cid) {
        const res = await this.getVideoDetailInfo(aid, cid)
        return res?.data?.subtitle?.subtitles || []
    }

    /**
     * 
     * @param {string} url 
     * @param {Headers | undefined} headers 
     */
    async getSubtitleJson(url, headers) {
        headers = await this.fillHeader(headers)
        const subUrl = url.startsWith("http") ? url : "https:" + url
        return await fetch(subUrl, { headers }).then((r) => r.json())
    }
}

class SubtitleFetcher {
    #videoInfo = {
        isInit: false,
        aid: null,
        cid: null,
        bvid: null,
    }
    #api = new BilibiliApi()

    get isInit() {
        return this.#videoInfo.isInit
    }

    get aid() {
        return this.#videoInfo.aid
    }

    get cid() {
        return this.#videoInfo.cid
    }

    get bvid() {
        return this.#videoInfo.bvid ?? Number.parseInt(Math.random() * 10000)
    }

    async getTitle() {
        const data = (await chrome.storage.local.get([this.#videoInfo.bvid]))[this.#videoInfo.bvid]
        if (!data) {
            return ""
        }
        const pages = data?.pages ?? []
        if (pages.length <= 1) {
            return data?.title ?? ""
        }
        const page = pages.find((p) => p.cid === this.#videoInfo.cid)
        return `${data?.title ?? ""}-${page?.part ?? ""}`
    }

    /**
     * init the required status such as video identity info
     * @param {object} data
     * @param {number | undefined} data.aid 
     * @param {number | undefined} data.cid 
     * @param {number | undefined} data.bvid
     * @param {Array<{cid:number, part:string}>} data.pages
     */
    init(data) {
        this.#videoInfo.aid = data.aid ?? null
        this.#videoInfo.cid =
            (data.p ? data.pages?.[data.p - 1]?.cid : data.cid) ?? null
        this.#videoInfo.bvid = data.bvid ?? null
        this.#videoInfo.isInit = this.#videoInfo.cid && this.#videoInfo.aid
        if (this.#videoInfo.bvid) {
            chrome.storage.local.set({
                [this.#videoInfo.bvid]: data,
            })
        }
    }

    /**
     * 
     * @param {Headers | undefined} headers 
     * @returns 
     */
    async getSubtitlesText(headers) {
        headers = await this.#api.fillHeader(headers)
        const subtitles = await this.#api.getVideoSubtitle(this.#videoInfo.aid, this.#videoInfo.cid, headers)
        const pref = subtitles.find((s) =>
            ["zh-CN", "zh", "ai-zh"].includes(s.lan)
        )
        if (!pref) return { error: "无可用字幕" }
        return await this.#api.getSubtitleJson(pref.subtitle_url, headers)
    }

    async fetchSubtitlesHandler(payload) {
        payload.mode = payload.mode ?? "srt"
        const { mode } = payload
        const subJson = await this.getSubtitlesText()
        switch (mode) {
            case "md":
                return this.bilisub2text(subJson)
            case "srt":
            default:
                return this.bilisub2srt(subJson)
        }
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
        return j.body.map((s) => s.content).join("\n")
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
}

class AISubtitleHandler {

    static defaultModelName() {
        return "gpt-3.5-turbo"
    }

    get prompt() {
        return `你是一个学霸，能很好地发掘视频提供的知识，请将以下视频字幕内容进行总结和提炼：
1. 去除所有礼貌用语、空泛介绍、玩笑话、广告、评价和不客观的观点
2. 保留对核心问题的介绍、解析、可行方式、步骤和示例
3. 可以轻度补充缺失的内容
4. 输出为结构清晰的Markdown格式`
    }

    /**
     * 
     * @param {SubtitleFetcher} fetcher 
     * @returns 
     */
    async summarizeSubtitlesHandler(fetcher) {
        const config = await chrome.storage.sync.get([
            "aiProvider",
            "aiEndpoint",
            "aiKey",
            "aiModel",
        ])
        if (!config.aiEndpoint) {
            return { error: "请先配置AI服务" }
        }
        const subtitles = fetcher.bilisub2text(
            await fetcher.getSubtitlesText()
        )
        const title = await fetcher.getTitle().catch(() => "")
        const summary = await this.processWithAI(title, subtitles, config)
        return { data: summary }
    }

    async processWithAI(title, text, config) {
        const completePrompt = `${this.prompt}

视频标题：${title}
字幕内容：
${text}`
        const signal = AbortSignal.timeout(5 * 60 * 1000)
        const response = await fetch(`${config.aiEndpoint}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.aiKey ?? ""}`,
            },
            body: JSON.stringify({
                model: config.aiModel ?? AISubtitleHandler.defaultModelName(),
                messages: [
                    {
                        role: "user",
                        content: completePrompt,
                    },
                ],
                temperature: 0.7,
            }),
            signal,
        })
        let data = await response.clone().json().catch(err => response.text())
        if (typeof data === "string") {
            data = new Error(data)
        }
        if (!data?.choices) {
            throw new Error(data?.message ?? data?.error?.message ?? "AI服务调用失败")
        }
        const arr = data?.choices?.[0]?.message?.content?.split("</think>") ?? [""]
        data = arr[1] ?? arr[0]
        const matchs = data.match(/```markdown([\s\S]+?)```/)
        return `# ${title}\n\n${matchs ? matchs[1] : data}`
    }
}

const downloadManager = new DownloadManager()
