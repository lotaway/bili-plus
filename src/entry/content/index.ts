export { }

function main() {
  console.debug('Start video content.js')
  addListener()
  injectScript()
  console.debug('End video content.js')
}

function addListener() {
  window.addEventListener('message', async (event) => {
    if (
      event.source !== window ||
      event.data?.source !== 'VIDEO_PAGE_INJECT'
    ) {
      return
    }

    switch (event.data.type) {
      case 'videoInfoInit':
        await chrome.runtime.sendMessage({
          type: 'VideoInfoUpdate',
          payload: event.data.payload,
        })
        break
      case 'openSidePanel':
        chrome.runtime.sendMessage({
          type: 'openSidePanel',
        })
        break
      default:
        break
    }
  })
}

function injectScript() {
  const script = document.createElement('script')
  const url = chrome.runtime.getURL('assets/video_page_inject.js')
  script.src = url
  document.documentElement.appendChild(script)
}

main()
