// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'

class DownloadManager {
    #subtitleFetcher = new SubtitleFetcher()
    #aiSubtitleHandler = new AISubtitleHandler()
    #aiAgentRunner = new AIAgentRunner()

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

                    const senderId = sender.id
                    const bvid = this.#subtitleFetcher.bvid
                    const cid = this.#subtitleFetcher.cid

                    // 流式处理总结
                    this.#aiSubtitleHandler
                        .summarizeSubtitlesHandler(this.#subtitleFetcher, chunk => {
                            chrome.runtime.sendMessage(senderId, {
                                type: "keepAlive",
                                data: {
                                    content: chunk,
                                    bvid,
                                    cid,
                                    done: false,
                                },
                            })
                        })
                        .then((summaryResult) => {
                            // 发送完整结果
                            chrome.runtime.sendMessage(senderId, {
                                type: "keepAlive",
                                data: {
                                    ...summaryResult,
                                    bvid,
                                    cid,
                                    done: true,
                                }
                            })
                            sendResponse({ done: true })
                        })
                        .catch((error) => {
                            console.error(error)
                            // 发送错误信息
                            chrome.runtime.sendMessage(senderId, {
                                type: "keepAlive",
                                data: {
                                    error: error instanceof Error
                                        ? error.message
                                        : JSON.stringify(error),
                                    bvid,
                                    cid
                                }
                            })
                            sendResponse({ done: true })
                        })

                    return true
                }
            case "VideoInfoUpdate":
                this.#subtitleFetcher.init(message.payload)
                break
            case "openSidePanel":
                chrome.sidePanel.open({ windowId: sender?.tab?.windowId })
                break
            case "startAssistant":
                this.#aiAgentRunner.runAgent(message.payload, chunk => {
                            chrome.runtime.sendMessage(senderId, {
                                type: "keepAlive",
                                data: {
                                    content: chunk,
                                    bvid,
                                    cid,
                                    done: false,
                                },
                            })
                        })
                        .then((summaryResult) => {
                            // 发送完整结果
                            chrome.runtime.sendMessage(senderId, {
                                type: "keepAlive",
                                data: {
                                    ...summaryResult,
                                    bvid,
                                    cid,
                                    done: true,
                                }
                            })
                            sendResponse({ done: true })
                        })
                        .catch((error) => {
                            console.error(error)
                            // 发送错误信息
                            chrome.runtime.sendMessage(senderId, {
                                type: "keepAlive",
                                data: {
                                    error: error instanceof Error
                                        ? error.message
                                        : JSON.stringify(error),
                                    bvid,
                                    cid
                                }
                            })
                            sendResponse({ done: true })
                        })
                return true

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

class AIAgentRunner {
    isBusy = false

    static defaultModelName() {
        return "gpt-3.5-turbo"
    }

    async runAgent(payload, onProgress) {
        if (this.isBusy) {
            return { error: "当前正在处理中，请稍后再试" }
        }

        const config = await chrome.storage.sync.get([
            "aiProvider",
            "aiEndpoint",
            "aiKey",
            "aiModel",
        ])

        if (!config.aiEndpoint) {
            return { error: "请先配置AI服务" }
        }

        this.isBusy = true
        try {
            // 调用agent端点
            const agentResponse = await fetch(`${config.aiEndpoint}/agents/run`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.aiKey ?? ""}`,
                },
                body: JSON.stringify({
                    messages: [payload.message],
                    model: config.aiModel || AIAgentRunner.defaultModelName(),
                }),
            })
            if (!agentResponse.ok) {
                throw new Error(`Agent请求失败: ${agentResponse.text}`, {
                    cause: agentResponse,
                })
            }
            const reader = agentResponse.body.getReader()
            const fullResponse = await this.readStream(reader, onProgress)
            return {
                data: fullResponse
            }
        } catch (error) {
            console.error("Agent调用错误:", error)
            return {
                error: error instanceof Error
                    ? error.message
                    : "Agent调用发生未知错误"
            }
        } finally {
            this.isBusy = false
        }
    }
}

class AISubtitleHandler {

    isBusy = false

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
     * @param {Function | undefined} onProgress 
     * @returns
     */
    async summarizeSubtitlesHandler(fetcher, onProgress) {
        if (this.isBusy) {
            return { error: "当前正在处理中，请稍后再试" }
        }
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
        this.isBusy = true
        const summary = await this.processWithAI(title, subtitles, config, onProgress).finally(() => {
            this.isBusy = false
        })
        return { data: summary }
    }

    /**
     * 
     * @param {String} title 
     * @param {String} text 
     * @param {Object} config 
     * @param {Function | undefined} onProgress 
     * @returns 
     */
    async processWithAI(title, text, config, onProgress) {
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
                stream: true
            }),
            signal,
        })

        const reader = response.body.getReader()

        const fullResponse = await this.readStream(reader, onProgress)
        const matchs = fullResponse.match(/```markdown([\s\S]+?)```/)
        return `# ${title}\n\n${matchs ? matchs[1] : fullResponse}`
    }

    async readStream(reader, onProgress = content => { console.debug(content) }) {
        const decoder = new TextDecoder()
        let buffer = ""
        let fullResponse = ""
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop()

            for (const line of lines) {
                if (line.startsWith('data:') && !line.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(line.substring(5))
                        const content = data.choices[0]?.delta?.content
                        if (content) {
                            fullResponse += content
                            onProgress?.(content)
                        }
                    } catch (e) {
                        console.error('Error parsing stream data:', e)
                    }
                }
            }
        }
    }
}

const downloadManager = new DownloadManager()
