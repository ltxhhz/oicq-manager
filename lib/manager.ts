import { EventEmitter } from "events";
import { Client, createClient } from "oicq"
import type oicq from 'oicq'
import type { Plugin } from './plugin'
import prompt from "prompt";
import { forIn } from "lodash";

export interface ClientList {
  [uin: number]: Client
}

export type PluginEvents<T = any> = {
  [k in keyof oicq.EventMap<T>]: oicq.EventMap<T>[k][]
}

export interface EventMap<T = any> {
  /**插件已安装到实例上 */
  'plugin-installed': (this: T, bot: Client, plugin: string) => void
  /** 只能捕获 install 方法运行错误，因为实例的监听事件的错误都会被 oicq 框架统一捕获并悄悄处理，如需查看可将 oicq 日志等级调整为 trace */
  'plugin-install-error': (this: T, bot: Client | 'all', plugin: string, error: Error) => void
  /** 插件从实例上卸载 */
  'plugin-uninstalled': (this: T, bot: Client, plugin: string) => void
}

export interface ManagerPlugin extends Plugin {
  error?: boolean,
  listeners: Partial<PluginEvents>
}

export interface PluginList {
  [id: string]: ManagerPlugin
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

export class Manager extends EventEmitter {
  readonly clientList: ClientList = new Proxy({}, {
    defineProperty: (target, p, attributes) => {
      forIn(this.pluginList, (plugin) => {
        if (!plugin.error) {
          try {
            plugin.install(this.#protectClient(attributes.value, plugin.id))
          } catch (error) {
            this.pluginUninstall(attributes.value, plugin.id)
            this.emit('plugin-install-error', attributes.value, plugin.id, error as Error)
          }
        }
      })
      return Reflect.defineProperty(target, p, attributes)
    },
  })
  readonly pluginList: PluginList = {}
  // readonly EventsList: 

  constructor() {
    super();
  }
  /**创建一个实例并尝试登录 */
  login(account: ManagerAccount): Promise<LoginResult> {
    let bot = createClient(account.uin, account.oicqConfig)
    this.clientList[bot.uin] ||= bot
    return new Promise((resolve) => {
      bot.once('system.login.qrcode', e => {
        resolve({
          type: 'qrcode',
          login: () => {
            return this.#login(bot)
          },
          ...e
        })
      }).once('system.login.slider', e => {
        resolve({
          type: 'slider',
          login: (e) => {
            return this.#login(bot, e)
          },
          ...e
        })
      }).once('system.login.device', e => {
        resolve({
          type: 'device',
          login: (e) => {
            return this.#login(bot, e)
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
  #login(bot: Client, config?: LoginParams): Promise<LoginResult> {
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
            return this.#login(bot)
          },
          ...e
        })
      }).once('system.login.slider', e => {
        resolve({
          type: 'slider',
          login: (e) => {
            return this.#login(bot, e)
          },
          ...e
        })
      }).once('system.login.device', e => {
        resolve({
          type: 'device',
          login: (e) => {
            return this.#login(bot, e)
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
   * 传入一个bot实例，如果在线则返回true，否则尝试登录，返回 LoginResult
   */
  async addClient(bot: Client): Promise<true | LoginResult> {
    if (bot.isOnline()) {
      this.clientList[bot.uin] ||= bot
      return true
    } else {
      return await this.login({ uin: bot.uin, oicqConfig: bot.config })
    }
  }
  #protectClient(bot: Client, pluginId: string) {
    const that = this
    return new Proxy(bot, {
      get(target, p: keyof Client, receiver) {
        if (p == 'on') {
          return new Proxy(target[p], {
            apply(target, thisArg, argArray) {
              if (typeof argArray[0] == 'symbol') return target.call(thisArg, argArray[0], argArray[1])
              console.log('事件监听', argArray[0], pluginId);
              that.#addListener(pluginId, argArray[0], argArray[1])
              return target.call(thisArg, argArray[0], argArray[1])
            },
          })
        } else {
          return target[p]
        }
      },
    })
  }
  #addListener(pluginId: string, eventName: keyof PluginEvents, listener: oicq.EventMap[keyof oicq.EventMap]) {
    const l = this.pluginList[pluginId].listeners[eventName]
    if (l) {
      (this.pluginList[pluginId].listeners[eventName] as Function[]).push(listener)
    } else {
      (this.pluginList[pluginId].listeners[eventName] as Function[]) = [listener]
    }
  }
  /** 使用插件 */
  add(plugin: Plugin): this { //检查属性
    if (Object.keys(this.pluginList).includes(plugin.id)) {
      this.emit('plugin-install-error', 'all', plugin.id, new Error('The ID of the plug-in is the same as that of other plug-ins.'))
    } else {
      let mp = this.#usePlugin(plugin)
      this.#pluginInstall(mp)
      this.pluginList[plugin.id] = mp
    }
    return this
  }

  #usePlugin(plugin: Plugin): ManagerPlugin {
    plugin.label ||= plugin.id
    return {
      listeners: {},
      ...plugin
    }
  }
  /** 从某个 bot 上卸载插件(取消插件添加的监听事件) */
  pluginUninstall(bot: Client, pluginId: string) {
    const plugin = this.pluginList[pluginId]
    for (const key in plugin.listeners) {
      const ls = plugin.listeners[key as keyof PluginEvents]
      ls!.forEach(e => bot.off(key, e))
      delete plugin.listeners[key as keyof PluginEvents]
    }
    this.emit('plugin-uninstalled', bot, pluginId)
  }

  #pluginInstall(plugin: ManagerPlugin) {
    try {
      if (plugin.enableList) {
        plugin.enableList.forEach(e => {
          if (this.clientList[e] && !plugin.error) {
            plugin.install(this.#protectClient(this.clientList[e], plugin.id))
          }
        })
      } else {
        forIn(this.clientList, (e) => {
          if (!plugin.error) {
            plugin.install(this.#protectClient(e, plugin.id))
          }
        })
      }
    } catch (error) {
      (plugin as Plugin & { error: boolean }).error = true
      if (plugin.enableList) {
        plugin.enableList.forEach(e => {
          this.clientList[e] && this.pluginUninstall(this.clientList[e], plugin.id)
        })
      } else {
        forIn(this.clientList, (e, i) => {
          this.pluginUninstall(e, plugin.id)
        })
      }
      this.emit('plugin-install-error', 'all', plugin.id, error as Error)
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