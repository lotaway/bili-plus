import { PageEventType } from '../../enums/PageEventType'
import { MessageType } from '../../enums/MessageType'
import { PageType } from '../../enums/PageType'
import { VideoData } from '../../types/video'

export { }

function main() {
  console.debug('Start video content.js')
  addListener()
  injectScript()
  console.debug('End video content.js')
}

function addListener() {
  chrome.runtime.sendMessage({
    type: MessageType.REGISTER_CONTENT_JS,
  }).catch(err => console.error(err))

  chrome.runtime.onMessage.addListener(handleMessage)

  window.addEventListener('message', async (event) => {
    if (
      event.source !== window ||
      event.data?.source !== PageType.VIDEO_PAGE_INJECT
    ) {
      return
    }

    switch (event.data.type) {
      case PageEventType.VIDEO_INFO_INIT:
        await chrome.runtime.sendMessage({
          type: MessageType.VIDEO_INFO_UPDATE,
          payload: event.data.payload as VideoData,
        })
        break
      case PageEventType.REQUEST_OPEN_SIDE_PANEL:
        chrome.runtime.sendMessage({
          type: MessageType.OPEN_SIDE_PANEL,
        })
        break
      default:
        break
    }
  })
}

type ChromeMessageEvent = [message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void]

function handleMessage(...args: ChromeMessageEvent) {
  const [message, sender, sendResponse] = args
  switch (message.type) {
    case MessageType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE:
      handleRequestVideoDownloadInPage(...args)
      return true
  }
  return false
}

function handleRequestVideoDownloadInPage(...args: ChromeMessageEvent) {
  const [message, sender, sendResponse] = args
  window.postMessage({
    source: PageType.CONTENT_SCRIPT,
    type: PageEventType.REQUEST_DOWNLOAD_VIDEO,
    payload: message.payload
  }, '*')
  const handleResponse = (event: MessageEvent) => {
    if (
      event.source !== window ||
      event.data?.source !== PageType.VIDEO_PAGE_INJECT ||
      event.data?.type !== PageEventType.REQUEST_DOWNLOAD_VIDEO
    ) {
      return
    }
    sendResponse(event.data.payload)
    window.removeEventListener('message', handleResponse)
  }

  window.addEventListener('message', handleResponse)
  return true
}

function injectScript() {
  const ID = "video_page_inject"
  const origin = document.getElementById(ID)
  if (origin) {
    document.removeChild(origin)
  }
  const script = document.createElement('script')
  script.id = ID
  const url = chrome.runtime.getURL('assets/video_page_inject.js')
  script.src = url
  document.documentElement.appendChild(script)
}

main()
