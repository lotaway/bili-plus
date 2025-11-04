function main() {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome runtime API is not available');
        return;
    }
    
    const args = globalThis.__EXT_ARG || {}
    const mode = args.mode || "srt"
    const match = globalThis.__INITIAL_STATE__?.videoData
    if (!match) {
        return
    }
    const aid = match.aid
    const cid = match.cid
    chrome.runtime.sendMessage({ type: "fetchSubtitles", aid, cid }, (res) => {
        if (res?.error) {
            alert(res.error)
            return
        }
        switch (mode) {
            case "text":
                const text = bilisub2text(res.subJson)
                downloadSrt(text, match.bvid, "md")
                break
            case "srt":
            default:
                const srt = bilisub2srt(res.subJson)
                downloadSrt(srt, match.bvid)
                break
        }
    })
}

function float2hhmmss(num) {
    const int_ = Number.parseInt(num)
    const frac = Number.parseInt((num - int_) * 1000)
    const hr = Math.floor(int_ / 3600)
    const min = Math.floor((int_ % 3600) / 60)
    const sec = int_ % 60
    return `${hr}:${String(min).padStart(2, "0")}:${String(sec).padStart(
        2,
        "0"
    )},${String(frac).padStart(3, "0")}`
}

function bilisub2srt(j) {
    return j.body
        .map(
            (s, i) =>
                `${i + 1}\n${float2hhmmss(s.from)} --> ${float2hhmmss(s.to)}\n${s.content
                }`
        )
        .join("\n\n")
}

function bilisub2text(j) {
    return j.body.map((s) => s.content).join("\n\n")
}

function downloadSrt(srt, name, ext = "srt") {
    const blob = new Blob([srt], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.${ext}`
    a.style.display = "none"
    document.documentElement.appendChild(a)
    requestAnimationFrame(() => {
        a.click()
        setTimeout(() => {
            a.remove()
            URL.revokeObjectURL(url)
        }, 3000)
    })
}

main()