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
    initButtonInjection();
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
    let p = Number(
        new URLSearchParams(globalThis.location.search).get("p") ?? 0
    )
    match.p = p
    window.postMessage({
        source: "VIDEO_PAGE_INJECT",
        type: "videoInfoInit",
        payload: match,
    })
}

// 注入生成按钮
function injectGenerateButton() {
    if (document.getElementById('bili-plus-generate-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'bili-plus-generate-btn';
    btn.textContent = '生成字幕/总结';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    btn.style.padding = '8px 16px';
    btn.style.backgroundColor = '#fb7299';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', () => {
        window.postMessage({
            source: 'VIDEO_PAGE_INJECT',
            type: 'openSidePanel'
        });
    });

    document.body.appendChild(btn);
}

// 初始化时注入按钮
function initButtonInjection() {
    injectGenerateButton();
    // 监听DOM变化确保按钮存在
    const observer = new MutationObserver(() => {
        injectGenerateButton();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

main();
