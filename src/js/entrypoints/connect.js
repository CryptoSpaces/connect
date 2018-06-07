/* @flow */
'use strict';

/**
 * (C) 2017 SatoshiLabs
 * TODO: description
 * GPLv3
 */

import TrezorBase, { eventEmitter } from '../index';

import * as TRANSPORT from '../constants/transport';
import * as POPUP from '../constants/popup';
import * as IFRAME from '../constants/iframe';
import * as UI from '../constants/ui';
import * as DEVICE from '../constants/device';

import { NO_IFRAME, IFRAME_INITIALIZED, DEVICE_CALL_IN_PROGRESS, IFRAME_TIMEOUT } from '../constants/errors';
import PopupManager from '../popup/PopupManager';
import Log, { init as initLog, getLog } from '../utils/debug';
import css from '../iframe/inline-styles';

import { create as createDeferred } from '../utils/deferred';

import { parseMessage, UiMessage, UI_EVENT, DEVICE_EVENT, RESPONSE_EVENT, TRANSPORT_EVENT } from '../core/CoreMessage';
import type { CoreMessage } from '../core/CoreMessage';

import { parse as parseSettings, setDataAttributes } from './ConnectSettings';
import type { ConnectSettings } from './ConnectSettings';
import type { Deferred } from 'flowtype';

const _log: Log = initLog('[trezor-connect.js]');

let _settings: ConnectSettings;
let _popupManager: PopupManager;
let _iframe: HTMLIFrameElement;
let _iframeOrigin: string;
let _iframeHandshakePromise: ?Deferred<void>;
let _messageID: number = 0;

// every postMessage to iframe has its own promise to resolve
const _messagePromises: { [key: number]: Deferred<any> } = {};

const initIframe = async (settings: Object): Promise<void> => {
    const existedFrame: HTMLIFrameElement = (document.getElementById('trezorconnect'): any);
    if (existedFrame) {
        _iframe = existedFrame;
    } else {
        _iframe = document.createElement('iframe');
        _iframe.frameBorder = '0';
        _iframe.width = '0px';
        _iframe.height = '0px';
        _iframe.style.position = 'absolute';
        _iframe.style.display = 'none';
        _iframe.style.border = '0px';
        _iframe.style.width = '0px';
        _iframe.style.height = '0px';
        _iframe.id = 'trezorconnect';
    }

    _settings = parseSettings(settings);
    _popupManager = initPopupManager();
    _log.enabled = _settings.debug;

    const src: string = `${_settings.iframeSrc}?${ Date.now() }`;
    _iframe.setAttribute('src', src);
    if (_settings.webusb) {
        _iframe.setAttribute('allow', 'usb');
    }

    // eslint-disable-next-line no-irregular-whitespace
    const iframeSrcHost: ?Array<string> = _iframe.src.match(/^.+\:\/\/[^\‌​/]+/);
    if (iframeSrcHost && iframeSrcHost.length > 0) { _iframeOrigin = iframeSrcHost[0]; }

    _iframe.onload = () => {

        if (typeof window.chrome !== 'undefined' && window.chrome.runtime && window.chrome.runtime.onConnect) {
            window.chrome.runtime.onConnect.addListener(() => {
                _log.log('chrome.runtime.onConnect');
            });
        }

        _iframe.contentWindow.postMessage({
            type: UI.IFRAME_HANDSHAKE,
            settings: _settings,
        }, _iframeOrigin);

        _iframe.onload = undefined;
    }

    if (document.body) {
        document.body.appendChild(_iframe);
    }

    _iframeHandshakePromise = createDeferred();
    return _iframeHandshakePromise.promise;
};

const injectStyleSheet = (): void => {
    const doc: Document = _iframe.ownerDocument;
    const head: HTMLElement = doc.head || doc.getElementsByTagName('head')[0];
    const style: HTMLStyleElement = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('id', 'TrezorConnectStylesheet');

    // $FlowIssue
    if (style.styleSheet) { // IE
        // $FlowIssue
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    head.append(style);
};

const initPopupManager = (): PopupManager => {
    const pm: PopupManager = new PopupManager(_settings);
    pm.on(POPUP.CLOSED, () => {
        postMessage({ type: POPUP.CLOSED }, false);
    });
    return pm;
};

// post messages to iframe
const postMessage = (message: any, usePromise: boolean = true): ?Promise<void> => {

    if (usePromise) {
        _messageID++;
        message.id = _messageID;
        _messagePromises[_messageID] = createDeferred();
        _iframe.contentWindow.postMessage(message, _iframeOrigin);
        return _messagePromises[_messageID].promise;
    }

    _iframe.contentWindow.postMessage(message, _iframeOrigin);
    return null;
};

// handle message received from iframe
const handleMessage = (messageEvent: MessageEvent): void => {
    // ignore messages from domain other then iframe origin
    if (messageEvent.origin !== _iframeOrigin) return;

    const message: CoreMessage = parseMessage(messageEvent.data);
    // TODO: destructuring with type
    // https://github.com/Microsoft/TypeScript/issues/240
    // const { id, event, type, data, error }: CoreMessage = message;
    const id: number = message.id || 0;
    const event: string = message.event;
    const type: string = message.type;
    const payload: any = message.payload;

    _log.log('handleMessage', message);

    switch (event) {
        case RESPONSE_EVENT :
            if (_messagePromises[id]) {
                // _messagePromises[id].resolve(data);
                _messagePromises[id].resolve(message);
                delete _messagePromises[id];
            } else {
                _log.warn(`Unknown message id ${id}`);
            }
            break;

        case DEVICE_EVENT :
            // pass DEVICE event up to html
            eventEmitter.emit(event, message);
            eventEmitter.emit(type, payload); // DEVICE_EVENT also emit single events (connect/disconnect...)
            break;

        case TRANSPORT_EVENT :
            eventEmitter.emit(event, message);
            eventEmitter.emit(type, payload); // DEVICE_EVENT also emit single events (connect/disconnect...)
            break;

        case UI_EVENT :
            // pass UI event up
            eventEmitter.emit(event, message);
            eventEmitter.emit(type, payload);

            if (type === UI.IFRAME_HANDSHAKE) {
                if (_iframeHandshakePromise) { _iframeHandshakePromise.resolve(); }
                _iframeHandshakePromise = null;
                injectStyleSheet();
            } else if (type === POPUP.CANCEL_POPUP_REQUEST) {
                _popupManager.cancel();
            } else if (type === UI.CLOSE_UI_WINDOW) {
                _popupManager.close();
            }
            break;

        default:
            _log.log('Undefined message', event, messageEvent);
    }
};

class TrezorConnect extends TrezorBase {
    // static on(type: string, fn: Function): void {
    //     eventEmitter.on(type, fn);
    // }

    // static off(type: string, fn: Function): void {
    //     eventEmitter.removeListener(type, fn);
    // }

    static async init(settings: Object = {}): Promise<void> {
        if (_iframe) { throw IFRAME_INITIALIZED; }

        // TODO: check browser support

        window.addEventListener('message', handleMessage);
        const iframeTimeout = window.setTimeout(() => {
            throw IFRAME_TIMEOUT;
        }, 20000);

        await initIframe(settings);
        window.clearTimeout(iframeTimeout);

        window.addEventListener('beforeunload', () => {
            if (_popupManager) {
                _popupManager.onBeforeUnload();
            }

            if (_iframe) {
                _iframe.setAttribute('src', _iframeOrigin);
                // if (_iframe.parentNode) {
                //     _iframe.parentNode.removeChild(_iframe);
                // }
            }
        });
    }

    static uiResponse(message: Object): void {
        // _core.handleMessage({ event: UI_EVENT, ...message });
        postMessage({ event: UI_EVENT, ...message });
    }

    static changeSettings(settings: Object) {
        const parsedSettings: ConnectSettings = parseSettings(settings);
        _log.enabled = parsedSettings.debug;
        postMessage({ type: UI.CHANGE_SETTINGS, payload: parsedSettings }, false);
    }

    // static async requestDevice() {
    //     return await this.__call({ method: 'requestDevice' });
    // }

    // static async getLog(args: ?Array<string>): Array<any> {
    //     const iframeLogs: ?Object = await postMessage({ type: 'getlog', payload: args });
    //     const localLogs = getLog(args);
    //     return []; //localLogs.concat(iframeLogs);
    // }

    static async __call(params: Object): Promise<Object> {
        if (_iframeHandshakePromise) {
            return { success: false, message: NO_IFRAME.message };
            // return new ResponseMessage();
        }

        // request popup. it might be used in the future
        // if (eventEmitter.listeners(UI_EVENT).length < 1) { _popupManager.request(params); }
        if (_settings.popup) { _popupManager.request(params); }

        // post message to iframe
        try {
            const response: ?Object = await postMessage({ type: IFRAME.CALL, payload: params });
            if (response) {
                // TODO: unlock popupManager request only if there wasn't error "in progress"
                if (response.payload.error !== DEVICE_CALL_IN_PROGRESS.message) { _popupManager.unlock(); }
                return response;
            } else {
                _popupManager.unlock();
                // TODO
                return { success: false };
            }
        } catch (error) {
            _log.error('__call error', error);
            return error;
        }
    }

    static transportConnect(): void {
        postMessage({ type: TRANSPORT.RECONNECT, payload: {} }, false);
    }

    static dispose(): void {
        // TODO
    }

    static getVersion(): Object {
        return {
            type: 'connect',
        };
    }

    static renderWebUSBButton(className: ?string): void {
        const query = className ? className : '.trezor-webusb-button';
        const buttons = document.querySelectorAll(query);
        const iframeSrc: string = `${_settings.webusbSrc}?${ Date.now() }`;

        buttons.forEach(b => {
            if (b.getElementsByTagName('iframe').length < 1) {
                const bounds = b.getBoundingClientRect();
                const iframe = document.createElement('iframe');
                iframe.frameBorder = '0';
                iframe.width = Math.round(bounds.width) + 'px';
                iframe.height = Math.round(bounds.height) + 'px';
                iframe.style.position = 'absolute';
                iframe.style.top = '0px';
                iframe.style.left = '0px';
                iframe.style.zIndex = '1';
                iframe.style.opacity = '0';
                iframe.setAttribute('allow', 'usb');
                iframe.setAttribute('scrolling', 'no');
                iframe.onload = () => {
                    iframe.contentWindow.postMessage({
                        // style: JSON.stringify( window.getComputedStyle(b) ),
                        // outer: b.outerHTML,
                        // inner: b.innerHTML
                    }, _iframeOrigin);
                }
                iframe.src = iframeSrc;

                // inject iframe into button
                b.append(iframe);
            }
        });
    }
}

// auto init
const scripts: HTMLCollection<HTMLScriptElement> = document.getElementsByTagName('script');
const index: number = scripts.length - 1;
const myself: HTMLScriptElement = scripts[index];
const queryString: string = myself.src.replace(/^[^\?]+\??/, '');

if (queryString === 'init') {
    TrezorConnect.init();
}

export default TrezorConnect;

export {
    TRANSPORT,
    UI,
    DEVICE,
    UI_EVENT,
    DEVICE_EVENT,
    TRANSPORT_EVENT,
    RESPONSE_EVENT,
};

// expose as window
window.TrezorConnect = TrezorConnect;
