async function main() {
    console.info("Start video inject.js")
    setInterval(() => {
        syncVideoInfo()
    }, 5 * 1000)
    console.info("End video inject.js")
}

function syncVideoInfo() {
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
