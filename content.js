function main() {
    console.info("Starting video content.js")
    setTimeout(() => {
        globalThis.dispatchEvent(new CustomEvent("RequestVideoInfo"))
    }, 500)
}

main()
