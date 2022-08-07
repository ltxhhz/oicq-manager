import { EventEmitter } from "events";
import { Client, createClient } from "oicq"
import type * as oicq from 'oicq'
import type { Plugin } from './plugin'
import prompt from "prompt";
import { forIn, remove } from "lodash";
import * as log4js from 'log4js';

export interface ClientList {
  [uin: number]: Client
}

export interface EventMap<T = any> {
  /**插件已安装到实例上 */
  'plugin-installed': (this: T, plugin: string) => void
  /** 只能捕获 install 方法运行错误，因为实例的监听事件的错误都会被 oicq 框架统一捕获并悄悄处理，如需查看可将 oicq 日志等级调整为 trace */
  'plugin-install-error': (this: T, plugin: string, error: Error) => void
  /** 插件从实例上卸载 */
  'plugin-uninstalled': (this: T, plugin: string) => void
  /** 添加 bot 实例 */
  'client-added': (this: T, uin: number) => void
  /** 删除 bot 实例 */
  'client-removed': (this: T, uin: number) => void
}
export type PluginEvents<T = any> = {
  [k in keyof oicq.EventMap<T>]: Array<oicq.EventMap<T>[k]>
}
export interface ManagerPlugin extends Plugin {
  error?: boolean,
  listeners: Partial<PluginEvents>
}

export interface PluginList {
  [id: string]: Plugin
}

export interface ManagerAccount {
  uin: number,
  pwd?: string,
  oicqConfig?: oicq.Config
}

/** 登录所需参数 */
export interface LoginParams {
  slider?: string,
  sms?: string
}

export type LoginResult = { type: 'qrcode', login: () => Promise<LoginResult>, image: Buffer } |
{ type: 'slider', login: (e?: LoginParams) => Promise<LoginResult>, url: string } |
{ type: 'device', login: (e?: LoginParams) => Promise<LoginResult>, sendSms: () => void, url: string, phone: string } |
{ type: 'error', code: number, message: string } |
{ type: 'ok' }

// export interface Manager4Plugin extends Manager {
//   _pluginId: string = ''
// }
export interface ListenerType {
  type: 'all' | number[]
  once?: boolean
  listener: oicq.EventMap[keyof oicq.EventMap]
}
export interface ListenerList {
  [pluginId: string]: {
    [eventName in keyof oicq.EventMap]?: ListenerType[]
  }
}

export interface Config {
  logLevel?: string | log4js.Level
}

export class Manager extends EventEmitter {
  readonly _pluginId: string = ''
  readonly logger: log4js.Logger
  readonly clientList: ClientList = new Proxy({}, {
    defineProperty: (target, p, attributes) => {//新增事件
      // Reflect.defineProperty(this._clientList, p, attributes)
      forIn(this.listenerList, (e) => {
        forIn(e, (e1, en) => {
          e1!.forEach(lt => {
            if (lt.type == 'all') this._clientList[attributes.value.uin][lt.once ? 'once' : 'on'](en, lt.listener)
          })
        })
      })
      return Reflect.defineProperty(target, p, attributes)
    },
    deleteProperty: (target, p) => {
      Reflect.deleteProperty(this._clientList, p)
      return Reflect.deleteProperty(target, p)
    },
  })
  private readonly _clientList: ClientList = {}
  private readonly _installQueue: Plugin[] = new Proxy([] as Plugin[], {
    set: (target, p, value, receiver) => {
      let res = Reflect.set(target, p, value, receiver)
      if (target.length && !this._installing) {
        let ins = () => {
          if (target[0]) {
            let pluginId = target[0].id
            this.logger.log(`[plugin:${pluginId}] 开始安装`)
            target[0].install(new Proxy(this, {
              get(target, p, receiver) {
                if (p == '_pluginId') {
                  return pluginId;
                } else {
                  return target[p as keyof Manager];
                }
              }
            })).then(() => {
              this.logger.log(`[plugin:${pluginId}] 安装完成`)
            }).catch(err => {
              this.logger.error(`[plugin:${pluginId}] 安装出错`, err)
              this.emit('plugin-install-error', pluginId, err)
            }).finally(() => {
              target.shift()
              ins()
            })
          } else {
            this._installing = false
          }
        }
        this._installing = true
        ins()
      }
      return res
    },
  })
  private _installing: boolean = false
  readonly pluginList: PluginList = {}
  readonly listenerList: ListenerList = {}

  constructor(config: Config = {}) {
    super();
    this.logger = log4js.getLogger('[oicq-manager]')
    this.logger.level = config.logLevel || log4js.levels.INFO
  }
  /**创建一个实例并尝试登录 */
  login(account: ManagerAccount): Promise<LoginResult> {
    if (this.clientList.hasOwnProperty(account.uin)) {
      throw new Error(`uin 为 ${account.uin} 的实例已经存在`)
    }
    let bot = createClient(account.uin, account.oicqConfig)
    this.clientList[bot.uin] = this._monitorClient(bot)
    return new Promise((resolve) => {
      bot.once('system.login.qrcode', e => {
        resolve({
          type: 'qrcode',
          login: () => {
            return this._login(bot)
          },
          ...e
        })
      }).once('system.login.slider', e => {
        resolve({
          type: 'slider',
          login: (e) => {
            return this._login(bot, e)
          },
          ...e
        })
      }).once('system.login.device', e => {
        resolve({
          type: 'device',
          login: (e) => {
            return this._login(bot, e)
          },
          sendSms: bot.sendSmsCode,
          ...e
        })
      }).once('system.login.error', e => {
        console.log('登录错误', e);
        resolve({
          type: 'error',
          ...e
        })
      }).once('system.online', e => {
        resolve({
          type: 'ok',
        })
      }).login(account.pwd)
    })
  }
  private _login(bot: Client, config?: LoginParams): Promise<LoginResult> {
    if (config?.slider) {
      console.log('提交划动验证码');
      bot.submitSlider(config.slider)
    } else if (config?.sms) {
      console.log('提交短信验证码');
      bot.submitSmsCode(config.sms)
    } else {
      bot.login()
    }
    return new Promise((resolve, reject) => {
      bot.once('system.login.qrcode', e => {
        resolve({
          type: 'qrcode',
          login: () => {
            return this._login(bot)
          },
          ...e
        })
      }).once('system.login.slider', e => {
        resolve({
          type: 'slider',
          login: (e) => {
            return this._login(bot, e)
          },
          ...e
        })
      }).once('system.login.device', e => {
        resolve({
          type: 'device',
          login: (e) => {
            return this._login(bot, e)
          },
          sendSms: bot.sendSmsCode,
          ...e
        })
      }).once('system.login.error', e => {
        console.log('登录错误', e);
        resolve({
          type: 'error',
          ...e
        })
      }).once('system.online', e => {
        resolve({
          type: 'ok',
        })
      })
    })
  }
  /**
   * 传入一个bot实例，但不尝试登录
   */
  addClient(bot: Client) {
    this.clientList[bot.uin] = this._monitorClient(bot)
    return this
  }
  private _monitorClient(bot: Client) {
    const that = this
    that._clientList[bot.uin] = bot
    return new Proxy(bot, {
      get(target, p: keyof Client, receiver) {
        if (p == 'on' || p == 'once' || p == 'addListener') {
          return new Proxy(target[p], {
            apply(target, thisArg: Client, argArray: Parameters<Client['on' | 'once' | 'addListener']>) {
              // if (typeof argArray[0] == 'symbol') return target.call(thisArg, argArray[0], argArray[1])
              that.logger.debug('事件监听', argArray[0], that._pluginId);
              that._addListener(that._pluginId, argArray[0] as keyof oicq.EventMap, {
                type: [thisArg.uin],
                once: p == 'once',
                listener: argArray[1]
              })
              // return target.call(thisArg, argArray[0], argArray[1])
              that[p == 'once' ? 'clientOnce' : 'clientOn'](argArray[0] as keyof oicq.EventMap, argArray[1], [thisArg.uin])
              return thisArg
            },
          })
        } else if (p == 'off' || p == 'removeListener') {
          return new Proxy(target[p], {
            apply(target, thisArg: Client, argArray: Parameters<Client['on' | 'once' | 'addListener']>) {
              // if (typeof argArray[0] == 'symbol') return target.call(thisArg, argArray[0], argArray[1])
              that.logger.debug('事件取消', argArray[0], that._pluginId);
              that._addListener(that._pluginId, argArray[0] as keyof oicq.EventMap, {
                type: [thisArg.uin],
                listener: argArray[1]
              })
              that.clientOff(argArray[0] as keyof oicq.EventMap, argArray[1], [thisArg.uin])
              return thisArg
            },
          })
        } else {
          return target[p]
        }
      },
    })
  }
  private _addListener<T extends keyof oicq.EventMap>(pluginId: string, eventName: T, listenerType: ListenerType) {
    this.listenerList[pluginId] ||= {};
    (this.listenerList[pluginId][eventName] ||= [] as ListenerType[])!.push(listenerType)
  }
  private _removeListener<T extends keyof oicq.EventMap>(pluginId: string, eventName: T, listenerType: ListenerType) {
    remove(this.listenerList[pluginId][eventName]!, e => (e.type == 'all' && listenerType.type == 'all') || ((e.type !== 'all' && listenerType.type !== 'all') && !e.type.some((e, i) => e != listenerType.type[i]) && e.listener == listenerType.listener))
  }
  /** 使用插件 */
  add(plugin: Plugin): this { //检查属性
    if (Object.keys(this.pluginList).includes(plugin.id)) {
      this.logger.error(`[plugin:${plugin.id}] 和已安装的插件id有重复`)
      this.emit('plugin-install-error', plugin.id, new Error('插件id和已安装的插件id有重复'))
    } else {
      this.pluginList[plugin.id] = plugin
      this._pluginInstall(plugin)
    }
    return this
  }
  private _pluginInstall(plugin: Plugin) {
    this._installQueue.push(plugin)
  }
  /** 卸载插件(取消插件添加的监听事件) */
  pluginUninstall(pluginId: string) {
    forIn(this.listenerList[pluginId], (e, en) => {
      e!.forEach(lt => {
        this.clientOff(en as keyof oicq.EventMap, lt.listener, lt.type)
      })
    })
    delete this.listenerList[pluginId]
    this.emit('plugin-uninstalled', pluginId)
  }
  /** 在指定实例上监听事件 */
  clientOn<T extends keyof oicq.EventMap>(eventName: T, listener: oicq.EventMap[T], list: number[] | 'all' = this.pluginList[this._pluginId].enableList || 'all') {
    if (list == 'all') {
      forIn(this._clientList, e => {
        e.on(eventName, listener)
      })
      this._addListener(this._pluginId, eventName, {
        type: 'all',
        listener
      })
    } else {
      list.forEach(e => {
        this._clientList[e].on(eventName, listener)
      })
      this._addListener(this._pluginId, eventName, {
        type: list,
        listener
      })
    }
  }
  /** 取消监听指定实例上的事件 */
  clientOff<T extends keyof oicq.EventMap>(eventName: T, listener: oicq.EventMap[T], list: number[] | 'all' = this.pluginList[this._pluginId].enableList || 'all') {
    if (list == 'all') {
      forIn(this._clientList, e => {
        e.off(eventName, listener)
      })
      this._removeListener(this._pluginId, eventName, {
        type: 'all',
        listener
      })
    } else {
      list.forEach(e => {
        this._clientList[e].off(eventName, listener)
      })
      this._removeListener(this._pluginId, eventName, {
        type: list,
        listener
      })
    }
  }
  /** 在指定实例上监听一次事件 */
  clientOnce<T extends keyof oicq.EventMap>(eventName: T, listener: oicq.EventMap[T], list: number[] | 'all' = this.pluginList[this._pluginId].enableList || 'all') {
    if (list == 'all') {
      forIn(this._clientList, e => {
        e.once(eventName, listener)
      })
      this._addListener(this._pluginId, eventName, {
        type: 'all',
        once: true,
        listener
      })
    } else {
      list.forEach(e => {
        this._clientList[e].once(eventName, listener)
      })
      this._addListener(this._pluginId, eventName, {
        type: list,
        once: true,
        listener
      })
    }
  }

  /** 辅助登录函数 */
  static async auxiliaryVerification(e: LoginResult): Promise<boolean> {
    prompt.start()
    let login: string
    switch (e.type) {
      case 'ok':
        return true
      case 'device':
        ({ login } = await prompt.get({ name: 'login', description: '使用url验证则留空，使用短信验证则输入任意值' }));
        if (login) {
          e.sendSms()
          let { sms } = await prompt.get({ name: 'sms', description: '输入短信收到的验证码', required: true })
          return e.login({ sms: sms as string }).then(e => Manager.auxiliaryVerification(e))
        } else {
          return await e.login().then(e => Manager.auxiliaryVerification(e))
        }
      case 'qrcode':
        ({ login } = await prompt.get({ name: 'login', description: '扫码后按 Enter 继续登录' }));
        return await e.login().then(e => Manager.auxiliaryVerification(e))
      case 'slider':
        ({ login } = await prompt.get({ name: 'login', description: '输入滑动验证码的 ticket 继续登录', required: true }));
        return await e.login({ slider: login }).then(e => Manager.auxiliaryVerification(e))
      case 'error':
        console.log('未知的登录错误', e);
        return false
      default:
        return false
    }
  }
}

export interface Manager {
  on<T extends keyof EventMap>(event: T, listener: EventMap<this>[T]): this
  emit<T extends keyof EventMap>(eventName: T, ...args: Parameters<EventMap[T]>): boolean
}