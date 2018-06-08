/* @flow */
'use strict';

import { UI_EVENT, DEVICE_EVENT, TRANSPORT_EVENT, RESPONSE_EVENT } from '../constants';
import type { CoreMessage } from 'flowtype';
import type { UiMessageFactory } from 'flowtype/ui-message';

// parse MessageEvent .data object into CoreMessage
export const parseMessage = (messageData: any): CoreMessage => {
    const message: CoreMessage = {
        event: messageData.event,
        type: messageData.type,
        payload: messageData.payload,
    }

    if (messageData.hasOwnProperty('id') && typeof messageData.id === 'number') {
        message.id = messageData.id;
    }

    if (messageData.hasOwnProperty('success') && typeof messageData.success === 'boolean') {
        message.success = messageData.success;
    }

    return message;
};

export const UiMessage: UiMessageFactory = (type, payload) => {
    return {
        event: UI_EVENT,
        type,
        payload,
    }
}

export const DeviceMessage = (type: string, payload: any): CoreMessage => {
    return {
        event: DEVICE_EVENT,
        type,
        payload,
    }
}

export const TransportMessage = (type: string, payload: any): CoreMessage => {
    return {
        event: TRANSPORT_EVENT,
        type,
        payload,
    }
}

export const ResponseMessage = (id: number, success: boolean, payload: any = null): CoreMessage => {
    return {
        event: RESPONSE_EVENT,
        type: RESPONSE_EVENT,
        id,
        success,
        payload,
    }
}
