export enum RequestPageEventType {
    VIDEO_INFO_INIT,
    REQUEST_OPEN_SIDE_PANEL,
    REQUEST_DOWNLOAD_VIDEO_IN_PAGE,
}

export type ReponsePageEventType = `Response[${RequestPageEventType}]`

export type PageEventType = RequestPageEventType | ReponsePageEventType

export interface BaseEventMessage<Event, Data> {
    source?: string
    type: Event
    payload: Data
}

export class EventMessageHelper<Data, Type, CustomEventMessage = BaseEventMessage<Data, Type>> {

    responsePageEvent(event: PageEventType, data: Data) {
        return {
            type: this.requestType2ResponseType(event),
            payload: data,
        } as CustomEventMessage
    }

    requestType2ResponseType(event: PageEventType) {
        return `Response[${event}]` as ReponsePageEventType
    }

    responseType2RequestType(event: PageEventType) {
        const matches = event.toString().match(/^Response\[(\s\S)?\]$/)
        if ((matches?.length ?? 0) >= 2) {
            return (matches as RegExpMatchArray)[1] as unknown as PageEventType
        }
        return null
    }

}

export class PgaeEventMessageHelper<Data> extends EventMessageHelper<Data, PageEventType> {
}