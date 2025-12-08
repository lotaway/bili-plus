import { MessageType } from "../enums/MessageType"

export interface ChromeMessage {
    type: MessageType
    data?: any
}