/* @flow */
'use strict';

import AbstractMethod from './AbstractMethod';
import { validatePath } from '../../utils/pathUtils';
import type { MessageResponse } from '../../device/DeviceCommands';
import type { MessageSignature } from 'flowtype/trezor';
import type { CoreMessage } from 'flowtype';

type Params = {
    path: Array<number>;
    message: string;
}

export default class EthereumSignMessage extends AbstractMethod {

    params: Params;

    constructor(message: CoreMessage) {
        super(message);

        this.requiredPermissions = ['write'];
        this.requiredFirmware = '1.0.0';
        this.useDevice = true;
        this.useUi = true;
        this.info = 'Sign Ethereum message';

        const payload: any = message.payload;

        if (!payload.hasOwnProperty('path')) {
            throw new Error('Parameter "path" is missing');
        } else {
            payload.path = validatePath(payload.path);
        }

        if (!payload.hasOwnProperty('message')){
            throw new Error('Parameter "message" is missing');
        } else if (typeof payload.message !== 'string') {
            throw new Error('Parameter "message" has invalid type. String expected.');
        }

        const messageHex: string = new Buffer(payload.message, 'utf8').toString('hex');
        this.params = {
            path: payload.path,
            message: messageHex
        }
    }

    async run(): Promise<Object> {
        const response: MessageResponse<MessageSignature> = await this.device.getCommands().ethereumSignMessage(
            this.params.path,
            this.params.message
        );
        return {
            ...response.message
        }
    }
}
