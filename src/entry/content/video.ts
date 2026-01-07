import { RequestPageEventType } from '../../enums/PageEventType'
import { MessageType } from '../../enums/MessageType'
import { PageType } from '../../enums/PageType'
import { VideoData } from '../../types/video'
import Logger from '../../utils/Logger'

export { }

type ChromeMessageEvent = [message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void]

class VideoContentActivity {
  @Logger.Mark("VideoContentActivity init")
  init() {
    this.addListener()
    this.injectScript()
  }

  addListener() {
    chrome.runtime.sendMessage({
      type: MessageType.REGISTER_CONTENT_JS,
    }).catch(err => Logger.E(err))

    chrome.runtime.onMessage.addListener(this.handleChromeMessage.bind(this))

    window.addEventListener('message', this.handlerWindowMessage.bind(this))
  }

  async handlerWindowMessage(event: MessageEvent) {
    if (
      event.source !== window ||
      event.data?.source !== PageType.VIDEO_PAGE_INJECT
    ) {
      return
    }

    switch (event.data.type) {
      case RequestPageEventType.VIDEO_INFO_INIT:
        await chrome.runtime.sendMessage({
          type: MessageType.VIDEO_INFO_UPDATE,
          sender: {
            id: chrome.runtime.id,
          },
          payload: event.data.payload as VideoData,
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

  handleChromeMessage(...args: ChromeMessageEvent) {
    const [message, sender, sendResponse] = args
    switch (message.type) {
      case MessageType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE:
        this.handleRequestVideoDownloadInPage(...args)
        return true
    }
    return false
  }

  handleRequestVideoDownloadInPage(...args: ChromeMessageEvent) {
    const [message, sender, sendResponse] = args
    window.postMessage({
      source: PageType.CONTENT_SCRIPT,
      type: RequestPageEventType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE,
      payload: message.payload
    }, '*')
    const handleResponse = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.data?.source !== PageType.VIDEO_PAGE_INJECT ||
        event.data?.type !== RequestPageEventType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE
      ) {
        return
      }
      sendResponse(event.data.payload)
      window.removeEventListener('message', handleResponse)
    }

    const handleProgressMessage = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.data?.source !== PageType.VIDEO_PAGE_INJECT ||
        event.data?.type !== RequestPageEventType.DOWNLOAD_PROGRESS_UPDATE
      ) {
        return
      }

      if (sender.id) {
        chrome.runtime.sendMessage(sender.id, {
          type: MessageType.DOWNLOAD_PROGRESS_UPDATE,
          data: event.data.payload
        })
      }
    }

    window.addEventListener('message', handleResponse)
    window.addEventListener('message', handleProgressMessage)

    const cleanup = () => {
      window.removeEventListener('message', handleResponse)
      window.removeEventListener('message', handleProgressMessage)
    }

    setTimeout(() => {
      cleanup()
    }, 5 * 60 * 1000)

    return true
  }

  injectScript() {
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
}

new VideoContentActivity().init()
