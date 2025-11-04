document.getElementById("extract").onclick = async () => {
    const [tab] = await init()
    await extract(tab, "srt")
    after()
}

document.getElementById("extract-only-text").onclick = async () => {
    const [tab] = await init()
    await extract(tab, "text")
    after()
}

async function init() {
    document.getElementById("msg").textContent = "正在提取字幕..."
    return await chrome.tabs.query({ active: true, currentWindow: true })
}

async function extract(tab, mode = "srt") {
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (args) => {
            globalThis.__EXT_ARG = args
        },
        args: [{ mode }],
        world: "MAIN",
    })
    return await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
        world: "MAIN",
    })
}

async function after() {
    document.getElementById("msg").textContent = "字幕提取完成"
}