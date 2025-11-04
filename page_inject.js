function main() {
    console.info("Starting video inject.js")
    const match = window.__INITIAL_STATE__?.videoData
    if (!match) {
        console.error("No video data found in globalThis.__INITIAL_STATE__")
        return
    }
    const aid = match.aid
    const cid = match.cid
    globalThis.dispatchEvent(
        new CustomEvent("VideoInfoUpdate", {
            detail: {
                aid,
                cid,
            },
        })
    )
}

main()