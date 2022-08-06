"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Manager_instances, _Manager_login, _Manager_protectClient, _Manager_addListener, _Manager_usePlugin, _Manager_pluginInstall;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manager = void 0;
const events_1 = require("events");
const oicq_1 = require("oicq");
const prompt_1 = __importDefault(require("prompt"));
const lodash_1 = require("lodash");
class Manager extends events_1.EventEmitter {
    // readonly EventsList: 
    constructor() {
        super();
        _Manager_instances.add(this);
        this.clientList = new Proxy({}, {
            defineProperty: (target, p, attributes) => {
                (0, lodash_1.forIn)(this.pluginList, (plugin) => {
                    if (!plugin.error) {
                        try {
                            plugin.install(__classPrivateFieldGet(this, _Manager_instances, "m", _Manager_protectClient).call(this, attributes.value, plugin.id));
                        }
                        catch (error) {
                            this.pluginUninstall(attributes.value, plugin.id);
                            this.emit('plugin-install-error', attributes.value, plugin.id, error);
                        }
                    }
                });
                return Reflect.defineProperty(target, p, attributes);
            },
        });
        this.pluginList = {};
    }
    /**创建一个实例并尝试登录 */
    login(account) {
        var _a, _b;
        let bot = (0, oicq_1.createClient)(account.uin, account.oicqConfig);
        (_a = this.clientList)[_b = bot.uin] || (_a[_b] = bot);
        return new Promise((resolve) => {
            bot.once('system.login.qrcode', e => {
                resolve(Object.assign({ type: 'qrcode', login: () => {
                        return __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_login).call(this, bot);
                    } }, e));
            }).once('system.login.slider', e => {
                resolve(Object.assign({ type: 'slider', login: (e) => {
                        return __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_login).call(this, bot, e);
                    } }, e));
            }).once('system.login.device', e => {
                resolve(Object.assign({ type: 'device', login: (e) => {
                        return __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_login).call(this, bot, e);
                    }, sendSms: bot.sendSmsCode }, e));
            }).once('system.login.error', e => {
                console.log('登录错误', e);
                resolve(Object.assign({ type: 'error' }, e));
            }).once('system.online', e => {
                resolve({
                    type: 'ok',
                });
            }).login(account.pwd);
        });
    }
    /**
     * 传入一个bot实例，如果在线则返回true，否则尝试登录，返回 LoginResult
     */
    async addClient(bot) {
        var _a, _b;
        if (bot.isOnline()) {
            (_a = this.clientList)[_b = bot.uin] || (_a[_b] = bot);
            return true;
        }
        else {
            return await this.login({ uin: bot.uin, oicqConfig: bot.config });
        }
    }
    /** 使用插件 */
    add(plugin) {
        if (Object.keys(this.pluginList).includes(plugin.id)) {
            this.emit('plugin-install-error', 'all', plugin.id, new Error('The ID of the plug-in is the same as that of other plug-ins.'));
        }
        else {
            let mp = __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_usePlugin).call(this, plugin);
            __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_pluginInstall).call(this, mp);
            this.pluginList[plugin.id] = mp;
        }
        return this;
    }
    /** 从某个 bot 上卸载插件(取消插件添加的监听事件) */
    pluginUninstall(bot, pluginId) {
        const plugin = this.pluginList[pluginId];
        for (const key in plugin.listeners) {
            const ls = plugin.listeners[key];
            ls.forEach(e => bot.off(key, e));
            delete plugin.listeners[key];
        }
        this.emit('plugin-uninstalled', bot, pluginId);
    }
    /** 辅助登录函数 */
    static async auxiliaryVerification(e) {
        prompt_1.default.start();
        let login;
        switch (e.type) {
            case 'ok':
                return true;
            case 'device':
                ({ login } = await prompt_1.default.get({ name: 'login', description: '使用url验证则留空，使用短信验证则输入任意值' }));
                if (login) {
                    e.sendSms();
                    let { sms } = await prompt_1.default.get({ name: 'sms', description: '输入短信收到的验证码', required: true });
                    return e.login({ sms: sms }).then(e => Manager.auxiliaryVerification(e));
                }
                else {
                    return await e.login().then(e => Manager.auxiliaryVerification(e));
                }
            case 'qrcode':
                ({ login } = await prompt_1.default.get({ name: 'login', description: '扫码后按 Enter 继续登录' }));
                return await e.login().then(e => Manager.auxiliaryVerification(e));
            case 'slider':
                ({ login } = await prompt_1.default.get({ name: 'login', description: '输入滑动验证码的 ticket 继续登录', required: true }));
                return await e.login({ slider: login }).then(e => Manager.auxiliaryVerification(e));
            case 'error':
                console.log('未知的登录错误', e);
                return false;
            default:
                return false;
        }
    }
}
exports.Manager = Manager;
_Manager_instances = new WeakSet(), _Manager_login = function _Manager_login(bot, config) {
    if (config === null || config === void 0 ? void 0 : config.slider) {
        console.log('提交划动验证码');
        bot.submitSlider(config.slider);
    }
    else if (config === null || config === void 0 ? void 0 : config.sms) {
        console.log('提交短信验证码');
        bot.submitSmsCode(config.sms);
    }
    else {
        bot.login();
    }
    return new Promise((resolve, reject) => {
        bot.once('system.login.qrcode', e => {
            resolve(Object.assign({ type: 'qrcode', login: () => {
                    return __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_login).call(this, bot);
                } }, e));
        }).once('system.login.slider', e => {
            resolve(Object.assign({ type: 'slider', login: (e) => {
                    return __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_login).call(this, bot, e);
                } }, e));
        }).once('system.login.device', e => {
            resolve(Object.assign({ type: 'device', login: (e) => {
                    return __classPrivateFieldGet(this, _Manager_instances, "m", _Manager_login).call(this, bot, e);
                }, sendSms: bot.sendSmsCode }, e));
        }).once('system.login.error', e => {
            console.log('登录错误', e);
            resolve(Object.assign({ type: 'error' }, e));
        }).once('system.online', e => {
            resolve({
                type: 'ok',
            });
        });
    });
}, _Manager_protectClient = function _Manager_protectClient(bot, pluginId) {
    const that = this;
    return new Proxy(bot, {
        get(target, p, receiver) {
            if (p == 'on') {
                return new Proxy(target[p], {
                    apply(target, thisArg, argArray) {
                        if (typeof argArray[0] == 'symbol')
                            return target.call(thisArg, argArray[0], argArray[1]);
                        console.log('事件监听', argArray[0], pluginId);
                        __classPrivateFieldGet(that, _Manager_instances, "m", _Manager_addListener).call(that, pluginId, argArray[0], argArray[1]);
                        return target.call(thisArg, argArray[0], argArray[1]);
                    },
                });
            }
            else {
                return target[p];
            }
        },
    });
}, _Manager_addListener = function _Manager_addListener(pluginId, eventName, listener) {
    const l = this.pluginList[pluginId].listeners[eventName];
    if (l) {
        this.pluginList[pluginId].listeners[eventName].push(listener);
    }
    else {
        this.pluginList[pluginId].listeners[eventName] = [listener];
    }
}, _Manager_usePlugin = function _Manager_usePlugin(plugin) {
    return Object.assign({ listeners: {} }, plugin);
}, _Manager_pluginInstall = function _Manager_pluginInstall(plugin) {
    try {
        if (plugin.enableList) {
            plugin.enableList.forEach(e => {
                if (this.clientList[e] && !plugin.error) {
                    plugin.install(__classPrivateFieldGet(this, _Manager_instances, "m", _Manager_protectClient).call(this, this.clientList[e], plugin.id));
                }
            });
        }
        else {
            (0, lodash_1.forIn)(this.clientList, (e) => {
                if (!plugin.error) {
                    plugin.install(__classPrivateFieldGet(this, _Manager_instances, "m", _Manager_protectClient).call(this, e, plugin.id));
                }
            });
        }
    }
    catch (error) {
        plugin.error = true;
        if (plugin.enableList) {
            plugin.enableList.forEach(e => {
                this.clientList[e] && this.pluginUninstall(this.clientList[e], plugin.id);
            });
        }
        else {
            (0, lodash_1.forIn)(this.clientList, (e, i) => {
                this.pluginUninstall(e, plugin.id);
            });
        }
        this.emit('plugin-install-error', 'all', plugin.id, error);
    }
};
