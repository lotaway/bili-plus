import { MessageType } from '../../enums/MessageType'
import { StudyAutomation } from '../../services/StudyAutomation'

export { }

function main() {
  console.debug('[Bilibili Plus] 首页content script已加载')
  addListener()
}

function addListener() {
  chrome.runtime.sendMessage({
    type: MessageType.REGISTER_CONTENT_JS,
  }).catch(err => console.error(err))
  chrome.runtime.onMessage.addListener(handleChromeMessage)
}

type ChromeMessageEvent = [message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void]

function handleChromeMessage(...args: ChromeMessageEvent): boolean {
  const [message, sender, sendResponse] = args

  switch (message.type) {
    case MessageType.START_STUDY_AUTOMATION:
      handleStartStudyAutomation(...args)
      return true
  }

  return false
}

function handleStartStudyAutomation(...args: ChromeMessageEvent) {
  const [message, sender, sendResponse] = args

  console.log('[Study Automation] 收到启动请求')

  try {
    const studyAutomation = new StudyAutomation()

    studyAutomation.startAutomation()
      .then(() => {
        console.log('[Study Automation] 自动化学习完成')
        sendResponse({ success: true, message: '自动化学习任务已提交' })
      })
      .catch((err: any) => {
        console.error('[Study Automation] 自动化学习失败:', err)
        sendResponse({
          error: err instanceof Error ? err.message : String(err),
          success: false
        })
      })
  } catch (err: any) {
    console.error('[Study Automation] 初始化失败:', err)
    sendResponse({
      error: err instanceof Error ? err.message : String(err),
      success: false
    })
  }

  return true
}

function isBilibiliHomepage(): boolean {
  const url = window.location.href
  return url === 'https://www.bilibili.com/' ||
    url === 'http://www.bilibili.com/' ||
    url.startsWith('https://www.bilibili.com/?') ||
    url.startsWith('http://www.bilibili.com/?')
}

if (isBilibiliHomepage()) {
  main()
} else {
  console.debug('[Bilibili Plus] 非首页，跳过执行')
}