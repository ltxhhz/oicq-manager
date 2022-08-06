/// <reference types="node" />
/// <reference types="node" />
import { EventEmitter } from "events";
import { Client } from "oicq";
import type oicq from 'oicq';
import type { Plugin } from './plugin';
export interface ClientList {
    [uin: number]: Client;
}
export declare type PluginEvents<T = any> = {
    [k in keyof oicq.EventMap<T>]: oicq.EventMap<T>[k][];
};
export interface EventMap<T = any> {
    /**插件已安装到实例上 */
    'plugin-installed': (this: T, bot: Client, plugin: string) => void;
    /** 只能捕获 install 方法运行错误，因为实例的监听事件的错误都会被 oicq 框架统一捕获并悄悄处理，如需查看可将 oicq 日志等级调整为 trace */
    'plugin-install-error': (this: T, bot: Client | 'all', plugin: string, error: Error) => void;
    /** 插件从实例上卸载 */
    'plugin-uninstalled': (this: T, bot: Client, plugin: string) => void;
}
export interface ManagerPlugin extends Plugin {
    error?: boolean;
    listeners: Partial<PluginEvents>;
}
export interface PluginList {
    [id: string]: ManagerPlugin;
}
export interface ManagerAccount {
    uin: number;
    pwd?: string;
    oicqConfig?: oicq.Config;
}
/** 登录所需参数 */
export interface LoginParams {
    slider?: string;
    sms?: string;
}
export declare type LoginResult = {
    type: 'qrcode';
    login: () => Promise<LoginResult>;
    image: Buffer;
} | {
    type: 'slider';
    login: (e?: LoginParams) => Promise<LoginResult>;
    url: string;
} | {
    type: 'device';
    login: (e?: LoginParams) => Promise<LoginResult>;
    sendSms: () => void;
    url: string;
    phone: string;
} | {
    type: 'error';
    code: number;
    message: string;
} | {
    type: 'ok';
};
export declare class Manager extends EventEmitter {
    #private;
    readonly clientList: ClientList;
    readonly pluginList: PluginList;
    constructor();
    /**创建一个实例并尝试登录 */
    login(account: ManagerAccount): Promise<LoginResult>;
    /**
     * 传入一个bot实例，如果在线则返回true，否则尝试登录，返回 LoginResult
     */
    addClient(bot: Client): Promise<true | LoginResult>;
    /** 使用插件 */
    add(plugin: Plugin): this;
    /** 从某个 bot 上卸载插件(取消插件添加的监听事件) */
    pluginUninstall(bot: Client, pluginId: string): void;
    /** 辅助登录函数 */
    static auxiliaryVerification(e: LoginResult): Promise<boolean>;
}
export interface Manager {
    on<T extends keyof EventMap>(event: T, listener: EventMap<this>[T]): this;
    emit<T extends keyof EventMap>(eventName: T, ...args: Parameters<EventMap[T]>): boolean;
}
