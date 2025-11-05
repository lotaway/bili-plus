async function main() {
    console.info("Start video inject.js")
    const match = globalThis.__INITIAL_STATE__?.videoData
    if (!match) {
        console.error("No video data found in window.__INITIAL_STATE__")
        return
    }
    const aid = match.aid
    const cid = match.cid
    const bvid = match.bvid
    // globalThis.dispatchEvent(
    //     new CustomEvent("VideoInfoUpdate", {
    //         detail: {
    //             aid,
    //             cid,
    //             bvid,
    //         },
    //     })
    // )
    window.postMessage({
        source: "VIDEO_PAGE_INJECT",
        payload: {
            aid,
            cid,
            bvid,
        },
    })

    console.info("End video inject.js")
}

main()
