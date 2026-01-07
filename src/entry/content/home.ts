
import { MessageType } from '../../enums/MessageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { PageType } from '../../enums/PageType'

export { }

function main() {
  console.debug('Start home content.js')
  addListener()
  injectScript()
  console.debug('End home content.js')
}

function addListener() {
  chrome.runtime.sendMessage({
    type: MessageType.REGISTER_CONTENT_JS,
  }).catch(err => console.error(err))
  chrome.runtime.onMessage.addListener(handleChromeMessage)
  window.addEventListener('message', handlerWindowMessage)
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

async function handleStartStudyAutomation(...args: ChromeMessageEvent) {
  const [message, sender, sendResponse] = args

  console.log('[Study Automation] 收到启动请求')

  try {
    const limitCount = message.payload?.limitCount || 10
    const result = await runStudyAutomation(limitCount)

    console.log('[Study Automation] 自动化学习完成')
    sendResponse({ message: '自动化学习任务已提交', ...result })
  } catch (err: any) {
    console.error('[Study Automation] 自动化学习失败:', err)
    sendResponse({
      error: err instanceof Error ? err.message : String(err),
      success: false
    })
  }

  return true
}

async function runStudyAutomation(limitCount: number) {
  let studyList: any[] = []
  let retryCount = 0
  const MAX_RETRIES = limitCount * 2

  while (studyList.length < limitCount && retryCount < MAX_RETRIES) {
    const batch = await sendHomePageAction('extractVideosFromPage')

    if (!batch.success || !batch.data || batch.data.length === 0) {
      await sendHomePageAction('clickChangeButton')
      await new Promise(r => setTimeout(r, 3000))
      retryCount++
      continue
    }

    const blackList = ['番剧', '动漫', '游戏', '开箱', '日常', 'vlog', '记录', '娱乐']
    const filteredVideos = batch.data.filter((v: any) => {
      const title = v.title.toLowerCase()
      if (title.length < 5) return false
      if (blackList.some(kw => title.includes(kw))) return false
      return true
    })

    const videoAnalysis = await analyzeVideosWithLLM(filteredVideos)
    const categorizedVideos = videoAnalysis.filter((item: any) =>
      item.category === 'class' || item.category === 'knowledge'
    )

    studyList.push(...categorizedVideos)
    retryCount++
  }

  studyList.sort((a: any, b: any) => (b.level + b.confidence) - (a.level + a.confidence))
  const finalSelection = studyList.slice(0, limitCount)

  const submittedTasks = []
  for (const item of finalSelection) {
    const studyRequest = await submitStudyRequest(item.link)
    submittedTasks.push({ link: item.link, submitted: studyRequest.success })
  }

  return {
    success: true,
    submittedCount: finalSelection.length,
    tasks: submittedTasks
  }
}

async function sendHomePageAction(action: string, params?: Record<string, any>): Promise<any> {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  window.postMessage({
    source: PageType.CONTENT_SCRIPT,
    type: RequestPageEventType.REQUEST_HOME_PAGE_ACTION,
    payload: { action, params, requestId }
  }, '*')

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'))
    }, 30000)

    const responseHandler = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.data?.source !== PageType.HOME_PAGE_INJECT ||
        event.data?.type !== RequestPageEventType.REQUEST_HOME_PAGE_ACTION ||
        event.data?.payload?.requestId !== requestId
      ) {
        return
      }

      clearTimeout(timeout)
      window.removeEventListener('message', responseHandler)

      const payload = event.data.payload
      if (payload.success) {
        resolve(payload.data)
      } else {
        reject(new Error(payload.error || '操作失败'))
      }
    }

    window.addEventListener('message', responseHandler)
  })
}

async function analyzeVideosWithLLM(videos: Array<{ title: string; link: string }>) {
  const prompt = `Please analyze these Bilibili video titles and determine which ones are "tutorials" or "knowledge-based" about real world. 
  Return a JSON array of objects with fields: category (class|knowledge), link, level (1-10), confidence (1-10), reason.
  Titles: ${JSON.stringify(videos.map(v => ({ title: v.title, link: v.link })))}`

  try {
    const result = await callLLMService(prompt)
    const content = result?.choices?.[0]?.message?.content || ''
    const jsonStr = content.match(/\[.*\]/s)?.[0]
    if (jsonStr) {
      return JSON.parse(jsonStr)
    }
  } catch (e) {
    console.error('Failed to parse LLM response', e)
  }
  return []
}

async function callLLMService(prompt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: MessageType.REQUEST_SUMMARIZE_SUBTITLE,
      payload: { prompt }
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

async function submitStudyRequest(link: string) {
  return new Promise<{ success: boolean }>((resolve) => {
    chrome.runtime.sendMessage({
      type: MessageType.REQUEST_SUMMARIZE_SUBTITLE,
      payload: {
        action: 'submitStudyRequest',
        link,
        platform: 'bilibili'
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to submit study request:', chrome.runtime.lastError)
        resolve({ success: false })
        return
      }
      resolve(response || { success: true })
    })
  })
}

function isBilibiliHomepage(): boolean {
  const url = window.location.href
  return url === 'https://www.bilibili.com/' ||
    url === 'http://www.bilibili.com/' ||
    url.startsWith('https://www.bilibili.com/?') ||
    url.startsWith('http://www.bilibili.com/?')
}

async function handlerWindowMessage(event: MessageEvent) {
  if (
    event.source !== window ||
    event.data?.source !== PageType.HOME_PAGE_INJECT
  ) {
    return
  }

  switch (event.data.type) {
    case RequestPageEventType.HOME_INFO_INIT:
      await chrome.runtime.sendMessage({
        type: MessageType.HOME_INFO_UPDATE,
        payload: event.data.payload,
      })
      break
    case RequestPageEventType.REQUEST_OPEN_SIDE_PANEL:
      chrome.runtime.sendMessage({
        type: MessageType.OPEN_SIDE_PANEL,
      })
      break
    default:
      break
  }
}

function injectScript() {
  const ID = "home_page_inject"
  const origin = document.getElementById(ID)
  if (origin) {
    document.removeChild(origin)
  }
  const script = document.createElement('script')
  script.id = ID
  const url = chrome.runtime.getURL('assets/home_page_inject.js')
  script.src = url
  document.documentElement.appendChild(script)
}

if (isBilibiliHomepage()) {
  main()
} else {
  console.debug('[Bilibili Plus] 非首页，跳过执行')
}

