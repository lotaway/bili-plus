import { InjectConfig } from '../../config/inject.config'
import { PageType } from '../../enums/PageType'
import { RequestPageEventType } from '../../enums/PageEventType'

type ButtonEventHandler = () => void

export class ButtonInjector {
    private observer: MutationObserver | null = null
    private buttonId: string

    constructor(private buttonConfig: typeof InjectConfig.homeButton) {
        this.buttonId = buttonConfig.id
    }

    inject(buttonHandler: ButtonEventHandler = this.defaultButtonHandler.bind(this)): void {
        this.injectButton(buttonHandler)
        this.startObserver(buttonHandler)
    }

    private injectButton(buttonHandler: ButtonEventHandler): void {
        if (document.getElementById(this.buttonId)) return

        const btn = document.createElement('button')
        btn.id = this.buttonId
        btn.textContent = this.buttonConfig.text
        this.applyButtonStyle(btn)
        btn.addEventListener('click', buttonHandler)
        document.body.appendChild(btn)
    }

    private applyButtonStyle(btn: HTMLButtonElement): void {
        const style = this.buttonConfig.style
        Object.entries(style).forEach(([key, value]) => {
            (btn.style as any)[key] = value
        })
    }

    private startObserver(buttonHandler: ButtonEventHandler): void {
        this.observer = new MutationObserver(() => {
            this.injectButton(buttonHandler)
        })
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        })
    }

    private defaultButtonHandler(): void {
        window.postMessage({
            source: PageType.HOME_PAGE_INJECT,
            type: RequestPageEventType[this.buttonConfig.eventType as keyof typeof RequestPageEventType],
        })
    }

    destroy(): void {
        if (this.observer) {
            this.observer.disconnect()
            this.observer = null
        }
        const btn = document.getElementById(this.buttonId)
        if (btn) {
            btn.remove()
        }
    }
}

export function createHomeButtonInjector(): ButtonInjector {
    return new ButtonInjector(InjectConfig.homeButton)
}

export function createVideoButtonInjector(): ButtonInjector {
    return new ButtonInjector(InjectConfig.videoButton)
}

