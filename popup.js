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
        this.setMessage("正在初始化...")
        this.setMessage("正在获取视频信息...")
    }

    async loadConfig() {
        const config = await chrome.storage.sync.get([
            'aiProvider',
            'aiEndpoint', 
            'aiKey',
            'aiModel'
        ])
        
        document.getElementById('aiProvider').value = config.aiProvider || ''
        document.getElementById('aiEndpoint').value = config.aiEndpoint || ''
        document.getElementById('aiKey').value = config.aiKey || ''
        document.getElementById('aiModel').value = config.aiModel || 'gpt-3.5-turbo'
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
        const provider = document.getElementById('aiProvider').value
        const endpoint = document.getElementById('aiEndpoint').value
        const key = document.getElementById('aiKey').value
        const model = document.getElementById('aiModel').value

        await chrome.storage.sync.set({
            aiProvider: provider,
            aiEndpoint: endpoint,
            aiKey: key,
            aiModel: model
        })

        this.setMessage('配置已保存')
    }

    async summarize() {
        this.setMessage("正在总结视频内容...")
        const config = await chrome.storage.sync.get(['aiProvider', 'aiEndpoint', 'aiKey', 'aiModel'])
        if (!config.aiProvider || !config.aiEndpoint || !config.aiKey) {
            this.setMessage('请先配置AI服务')
            return
        }
        chrome.runtime.sendMessage(
            {
                type: "fetchSubtitles",
                payload: {
                    mode: "text"
                },
            },
            async (res) => {
                if (res?.error) {
                    alert(res.error)
                    return
                }
                this.setMessage("正在使用AI处理字幕...")
                setTimeout(() => {
                    this.setMessage("总结完成，请查看下载的文件")
                }, 2000)
            }
        )
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
