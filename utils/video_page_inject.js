let isWindowActivate = true

async function main() {
    console.debug("Start video inject.js")
    syncVideoInfo()
    const timer = setInterval(() => {
        syncVideoInfo()
    }, 5 * 1000)
    document.addEventListener('visibilitychange', () => {
        isWindowActivate = document.visibilityState === 'visible'
        syncVideoInfo()
    })
    window.addEventListener("unload", () => {
        clearInterval(timer)
    })
    console.debug("End video inject.js")
}

function syncVideoInfo(needCheck = true) {
    if (needCheck && !isWindowActivate)
        return
    const match = globalThis.__INITIAL_STATE__?.videoData
    if (!match) {
        console.error("No video data found in window.__INITIAL_STATE__")
        return
    }
    // globalThis.dispatchEvent(
    //     new CustomEvent("VideoInfoUpdate", {
    //         detail: match,
    //     })
    // )
    let p = Number(
        new URLSearchParams(globalThis.location.search).get("p") ?? 0
    )
    match.p = p
    window.postMessage({
        source: "VIDEO_PAGE_INJECT",
        payload: match,
    })
}

main()
