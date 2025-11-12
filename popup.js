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

    async loadConfig() {
        const config = await chrome.storage.sync.get([
            "aiProvider",
            "aiEndpoint",
            "aiKey",
            "aiModel",
        ])

        document.getElementById("aiProvider").value = config.aiProvider || ""
        document.getElementById("aiEndpoint").value = config.aiEndpoint || ""
        document.getElementById("aiKey").value = config.aiKey || ""
        document.getElementById("aiModel").value =
            config.aiModel || "gpt-3.5-turbo"
    }

    initButton() {

        document
            .getElementById("saveConfig")
            .addEventListener("click", async () => {
                await this.saveConfig()
            })

        document
            .getElementById("openSidePanel")
            .addEventListener("click", async () => {
                await this.openSidePanel()
            })
    }

    async saveConfig() {
        const provider = document.getElementById("aiProvider").value
        const endpoint = document.getElementById("aiEndpoint").value
        const key = document.getElementById("aiKey").value
        const model = document.getElementById("aiModel").value

        await chrome.storage.sync.set({
            aiProvider: provider,
            aiEndpoint: endpoint,
            aiKey: key,
            aiModel: model,
        })

        this.setMessage("配置已保存")
    }

    async openSidePanel() {
        try {
            const window = await chrome.windows.getCurrent()
            chrome.sidePanel.open({ windowId: window.id })
        } catch (error) {
            console.error("Failed to open side panel:", error)
        }
    }

}

new PopupController()
