function main() {
    console.info("Starting video content.js")
    const script = document.createElement('script')
    const url = chrome.runtime.getURL("utils/video_page_inject.js")
    script.src = url
    document.documentElement.appendChild(script)
}

main()
