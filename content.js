function main() {
    console.debug("Start video content.js")
    addListener()
    injectScript()
    console.info("End video content.js")
}

function addListener() {
    globalThis.addEventListener("message", async event => {
        if (event.source != globalThis) {
            return
        }
        if (event.data?.source !== "VIDEO_PAGE_INJECT") {
            return
        }
        console.info("video content.js got message", event.data)
        const result = await chrome.runtime.sendMessage({
            type: "VideoInfoUpdate",
            payload: event.data.payload,
        })
        console.info("video content.js got result", result)
    })
}

function injectScript() {
    const script = document.createElement("script")
    const url = chrome.runtime.getURL("utils/video_page_inject.js")
    script.src = url
    document.documentElement.appendChild(script)
    console.debug("End video content.js")
}

main()
