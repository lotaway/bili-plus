function main() {
    console.debug("Start video content.js")

    globalThis.addEventListener("message", event => {
        if (event.source != globalThis) {
            return
        }
        if (event.data?.source !== "VIDEO_PAGE_INJECT") {
            return
        }
        chrome.runtime.sendMessage({
            type: "VideoInfoUpdate",
            payload: event.payload,
        })
    })

    const script = document.createElement("script")
    const url = chrome.runtime.getURL("utils/video_page_inject.js")
    script.src = url
    document.documentElement.appendChild(script)

    console.debug("End video content.js")
}

main()
