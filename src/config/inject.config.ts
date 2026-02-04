export interface ButtonStyleConfig {
    position: 'fixed'
    bottom: string
    right: string
    zIndex: string
    padding: string
    backgroundColor: string
    color: string
    border: string
    borderRadius: string
    cursor: string
}

export interface SelectorConfig {
    homePageContainer: string
    videoCard: string
    videoCardTitle: string
    rollButton: string
}

export interface InjectConfig {
    homeButton: {
        id: string
        text: string
        style: ButtonStyleConfig
        eventType: string
    }
    videoButton: {
        id: string
        text: string
        style: ButtonStyleConfig
        eventType: string
    }
    selectors: SelectorConfig
    syncIntervalMs: number
}

export const InjectConfig: InjectConfig = {
    homeButton: {
        id: 'bili-plus-home-generate-btn',
        text: '自动学习',
        style: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '9999',
            padding: '8px 16px',
            backgroundColor: '#fb7299',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        },
        eventType: 'REQUEST_OPEN_SIDE_PANEL',
    },
    videoButton: {
        id: 'bili-plus-generate-btn',
        text: '生成字幕/总结',
        style: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '9999',
            padding: '8px 16px',
            backgroundColor: '#fb7299',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        },
        eventType: 'REQUEST_OPEN_SIDE_PANEL',
    },
    selectors: {
        homePageContainer: '.bili-feed4-layout,.bili-feed-layout',
        videoCard: '.bili-video-card,.video-card,.v-card',
        videoCardTitle: '.bili-video-card__info--tit,.bili-video-card h3,.video-card__info--tit',
        rollButton: '.roll-btn,.feed-roll-btn',
    },
    syncIntervalMs: 5 * 1000,
}

