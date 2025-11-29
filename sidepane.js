
class SidePaneController {

    #ventTypes = new Map()

    constructor() {
        this.init()
    }

    init() {
        this.initButton()
        this.#ventTypes.set("summarize:keepAlive", {
            type: "summarize:keepAlive",
            handler: this.handleSummarizeKeepAliveMessage,
        })
        this.#ventTypes.set("assistant:keepAlive", {
            type: "assistant:keepAlive",
            handler: this.handleAssistantKeepAliveMessage,
        })
    }

    initButton() {
        document.addEventListener('DOMContentLoaded', () => {
            chrome.runtime.onMessage.addListener((message) => {
                this.#ventTypes.get(message.type)?.handler(message.data)
            })
            document
                .getElementById("extract")
                .addEventListener("click", async () => {
                    await this.extract("srt")
                })
            document
                .getElementById("extract-only-text")
                .addEventListener("click", async () => {
                    await this.extract("md")
                })
            document.getElementById('summary').addEventListener('click', () => this.summarize())
            document.getElementById("assistant").addEventListener("click", () => this.assistant())
        })
    }

    async sendMessage(payload) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(payload, resolve)
        })
    }

    async summarize(requireDownload = false) {
        this.setMessage("正在使用AI处理字幕...")
        const res = this.sendMessage({
            type: "summarize",
        })
        if (res?.error) {
            this.setMessage(res.error)
            return
        }
        if (!requireDownload) {
            return
        }
        const textData = this.text2url(res.data, "md")
        const textFilePromise = this.downloadFile(
            textData.url,
            `${res.bvid}-${res.cid}-summary.md`
        )
        textFilePromise.finally(textData.destory)
        const downloadId = await textFilePromise
        this.setMessage(`总结完成，请查看下载的文件, ${downloadId}`)
    }

    async assistant() {
        this.setMessage("正在启动AI智能体...")
        await this.sendMessage({
            type: "startAssistant",
            payload: {
                message: "帮我做一个视频观看规划"
            }
        })
    }

    setMessage(msg) {
        document.getElementById("result-container").textContent = msg
    }

    async extract(mode = "srt") {
        this.setMessage("正在提取字幕...")
        const res = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    type: "fetchSubtitles",
                    payload: {
                        mode,
                    },
                },
                async (res) => resolve(res)
            )
        })
        if (res?.error) {
            this.setMessage(res.error)
            return
        }
        let downloadId = -1
        switch (mode) {
            case "md":
                const textData = this.text2url(res.data, mode)
                const textFilePromise = this.downloadFile(
                    textData.url,
                    `${res.bvid}-${res.cid}.md`
                )
                textFilePromise.finally(textData.destory)
                downloadId = await textFilePromise
                break
            case "srt":
                const srtData = this.text2url(res.data, mode)
                const srtFilePromise = this.downloadFile(
                    srtData.url,
                    `${res.bvid}-${res.cid}.srt`
                )
                srtFilePromise.finally(srtData.destory)
                downloadId = await srtFilePromise
                break
            default:
                break
        }
        this.afterDownload(downloadId)
    }

    text2url(text, fileType = "txt") {
        const fileType2MediaType = new Map([
            ["txt", "text/plain"],
            ["md", "text/markdown"],
            ["xmd", "text/x-markdown"],
            ["srt", "application/x-subrip"],
        ])
        const blob = new Blob([text], {
            type: fileType2MediaType.get(fileType),
        })
        const url = URL.createObjectURL(blob)
        return {
            url,
            destory: () => URL.revokeObjectURL(url),
        }
    }

    async downloadFile(url, filename) {
        return await chrome.downloads.download({
            url,
            filename,
            conflictAction: "uniquify",
            saveAs: false,
        })
    }

    afterDownload(id) {
        this.setMessage(`字幕提取完成:${id}`)
    }

    handleSummarizeKeepAliveMessage(data) {
        const resultContainer = document.getElementById('result-container')
        if (data.error) {
            this.setMessage(data.error)
            return
        }
        if (data.done && data.content) {
            this.showStreamResult(data.data)
            return
        }
        if (data.content) {
            resultContainer.innerHTML += data.content
        }
    }

    handleAssistantKeepAliveMessage(data) {
        const resultContainer = document.getElementById('result-container')
        
        // Handle decision required case
        if (data.decision_required) {
            this.showDecisionUI(data)
            return
        }
        
        if (data.error) {
            this.setMessage(data.error)
            return
        }
        if (data.done && data.content) {
            this.showStreamResult(data.data)
            return
        }
        if (data.content) {
            resultContainer.innerHTML += data.content
        }
    }

    showDecisionUI(decisionData) {
        const resultContainer = document.getElementById('result-container')
        
        // Clear previous content
        resultContainer.innerHTML = ''
        
        // Create decision UI based on the reason
        let decisionHTML = '<div class="decision-container">'
        decisionHTML += `<h4>⏸️ 需要人工决策</h4>`
        decisionHTML += `<p><strong>原因:</strong> ${decisionData.reason || decisionData.message || '需要用户确认'}</p>`
        
        if (decisionData.reason === 'waiting_human') {
            decisionHTML += `
                <p>工作流已暂停，等待您的决策。</p>
                <div class="decision-buttons">
                    <button class="decision-btn approve-btn" data-action="approved">同意继续</button>
                    <button class="decision-btn reject-btn" data-action="feedback">提供反馈</button>
                </div>
                <div class="feedback-input" style="display: none; margin-top: 10px;">
                    <textarea id="feedback-text" placeholder="请输入您的反馈意见..." rows="3" style="width: 100%;"></textarea>
                    <button id="submit-feedback" style="margin-top: 5px;">提交反馈</button>
                </div>
            `
        } else if (decisionData.reason === 'max_iterations') {
            decisionHTML += `
                <p>已达到最大迭代次数 (${decisionData.max_iterations})，请决定是否继续。</p>
                <div class="decision-buttons">
                    <button class="decision-btn approve-btn" data-action="approved">继续执行</button>
                    <button class="decision-btn reject-btn" data-action="false">停止执行</button>
                </div>
            `
        } else {
            decisionHTML += `
                <p>需要您的决策才能继续。</p>
                <div class="decision-buttons">
                    <button class="decision-btn approve-btn" data-action="approved">同意</button>
                    <button class="decision-btn reject-btn" data-action="false">拒绝</button>
                </div>
            `
        }
        
        decisionHTML += '</div>'
        resultContainer.innerHTML = decisionHTML
        
        // Add event listeners
        this.setupDecisionEventListeners(decisionData)
    }

    setupDecisionEventListeners(decisionData) {
        // Handle decision buttons
        document.querySelectorAll('.decision-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action')
                
                if (action === 'feedback') {
                    // Show feedback input
                    document.querySelector('.feedback-input').style.display = 'block'
                    return
                }
                
                this.sendDecision(decisionData, action)
            })
        })
        
        // Handle feedback submission
        const submitFeedbackBtn = document.getElementById('submit-feedback')
        if (submitFeedbackBtn) {
            submitFeedbackBtn.addEventListener('click', () => {
                const feedbackText = document.getElementById('feedback-text').value
                if (feedbackText.trim()) {
                    this.sendDecision(decisionData, 'feedback', feedbackText)
                }
            })
        }
    }

    async sendDecision(decisionData, decision, feedback = '') {
        const resultContainer = document.getElementById('result-container')
        resultContainer.innerHTML = '<p>正在处理您的决策...</p>'
        
        try {
            const config = await chrome.storage.sync.get([
                "aiProvider",
                "aiEndpoint",
                "aiKey",
            ])
            
            if (!config.aiEndpoint) {
                throw new Error("请先配置AI服务")
            }
            
            const decisionPayload = {
                approved: decision === 'approved',
                feedback: feedback,
                ...decisionData
            }
            
            const response = await fetch(`${config.aiEndpoint}/agents/decision`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.aiKey ?? ""}`,
                },
                body: JSON.stringify(decisionPayload),
            })
            
            if (!response.ok) {
                throw new Error(`决策提交失败: ${await response.text()}`)
            }
            
            resultContainer.innerHTML = '<p>决策已提交，继续处理中...</p>'
            
        } catch (error) {
            console.error('Decision submission error:', error)
            resultContainer.innerHTML = `<p style="color: red;">决策提交失败: ${error.message}</p>`
        }
    }

    showStreamResult(data) {
        const resultContainer = document.getElementById('result-container')
        // 简单markdown渲染
        resultContainer.innerHTML = data
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
    }
}

new SidePaneController()