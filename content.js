function main() {
    console.debug("Start video content.js")
    addListener()
    injectScript()
    console.debug("End video content.js")
}

function addListener() {
    globalThis.addEventListener("message", async event => {
        if (event.source != globalThis || event.data?.source !== "VIDEO_PAGE_INJECT") {
            return
        }
        const result = await chrome.runtime.sendMessage({
            type: "VideoInfoUpdate",
            payload: event.data.payload,
        })
    })
}

function injectScript() {
    const script = document.createElement("script")
    const url = chrome.runtime.getURL("utils/video_page_inject.js")
    script.src = url
    document.documentElement.appendChild(script)
}

main()
