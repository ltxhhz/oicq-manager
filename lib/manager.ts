import { EventEmitter } from "events";
import { Client, createClient } from "oicq"
import type oicq from 'oicq'
import { EventMap } from "./events";
import type { Plugin } from './plugin'
import prompt from "prompt";

export interface ClientList {
  [uin: number]: Client
}
//#region 
// export const PermissionList = {
//   getCookies: '[敏感]获取cookie',

// }

// export enum Permissions {
//   /** [所有权限] */
//   all,
//   /** [敏感]取Cookies */
//   getCookies,
//   getRecord,
//   sendGroupMsg,
//   sendDiscussMsg,
//   sendPrivateMsg,
//   sendLike,
//   setGroupKick,
//   setGroupBan,
//   setGroupAdmin,
//   setGroupWholeBan,
//   setGroupAnonymousBan,
//   setGroupAnonymous,
//   setGroupCard,
//   setGroupLeave,
//   setGroupSpecialTitle,
//   getGroupMemberInfo,
//   getStrangerInfo,
//   setDiscussLeave,
//   setFriendAddRequest,
//   setGroupAddRequest,
//   getGroupMemberList,
//   getGroupList,
//   deleteMsg
// }
// [ // 应用权限（发布前请删除无用权限）
//   20,  //[敏感]取Cookies    getCookies / getCsrfToken
//   30,  //接收语音            getRecord
//   101, //发送群消息            sendGroupMsg
//   103, //发送讨论组消息        sendDiscussMsg
//   106, //发送私聊消息        sendPrivateMsg
//   110, //发送赞                sendLike
//   120, //置群员移除            setGroupKick
//   121, //置群员禁言            setGroupBan
//   122, //置群管理员            setGroupAdmin
//   123, //置全群禁言            setGroupWholeBan
//   124, //置匿名群员禁言        setGroupAnonymousBan
//   125, //置群匿名设置        setGroupAnonymous
//   126, //置群成员名片        setGroupCard
//   //127, //[敏感]置群退出        setGroupLeave
//   128, //置群成员专属头衔    setGroupSpecialTitle
//   130, //取群成员信息        getGroupMemberInfoV2 / getGroupMemberInfo
//   131, //取陌生人信息        getStrangerInfo
//   140, //置讨论组退出        setDiscussLeave
//   150, //置好友添加请求        setFriendAddRequest
//   151, //置群添加请求        setGroupAddRequest
//   160, //取群成员列表        getGroupMemberList
//   161, //取群列表            getGroupList
//   180 //撤回消息            deleteMsg
// ]
//#endregion


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

export class Manager extends EventEmitter {
  readonly clientList: ClientList = {}
  readonly pluginList: PluginList = {}

  constructor() {
    super();

  }
  /**创建一个实例并尝试登录 */
  login(account: ManagerAccount): Promise<LoginResult> {
    let bot = createClient(account.uin, account.oicqConfig)
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
        this.clientList[bot.uin] ||= bot
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
        this.clientList[bot.uin] ||= bot
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

  use(plugin: string | Plugin): this {
    if (typeof plugin == 'string') {
      let module
      try {
        module = require(plugin)
      } catch (error) {
        this.emit('plugin-install-error', plugin, error as Error)
        return this
      }
      this.pluginList[plugin] ||= module
    } else {//检查属性
      if (plugin.id && plugin.label && !!plugin.function) {
        this.pluginList[plugin.id] ||= plugin
      } else {
        this.emit('plugin-install-error', plugin.id, new Error('The provided plugin has incomplete properties'))
      }
    }
    return this
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
        console.log('无法处理的登录错误', e);
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