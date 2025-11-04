chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === "fetchSubtitles") {
        const { aid, cid } = msg
        const cookieStore = await chrome.cookies.getAll({
            domain: ".bilibili.com",
        })
        const cookieHeader = cookieStore
            .map((c) => `${c.name}=${c.value}`)
            .join("; ")
        const url = `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`
        const headers = { Cookie: cookieHeader }
        const j = await fetch(url, { headers }).then((r) => r.json())
        const subtitles = j?.data?.subtitle?.subtitles || []
        const pref = subtitles.find((s) =>
            ["ai-zh", "zh", "zh-CN"].includes(s.lan)
        )
        if (!pref) return sendResponse({ error: "无可用字幕" })
        const subUrl = "https:" + pref.subtitle_url
        const subJson = await fetch(subUrl, { headers }).then((r) => r.json())
        sendResponse({ subJson })
    }
    return true
})
