// import type { PluginError, PluginInstallError } from "./errors"




export interface EventMap<T = any> {
  'plugin-installed': (this: T, plugin: string) => void
  /** 只能捕获 install 方法运行错误，因为实例的监听事件都会被统一捕获并悄悄处理，如需查看可将oicq 日志等级调整为 trace */
  'plugin-install-error': (this: T, plugin: string, error: Error) => void
  'plugin-uninstalled': (this: T, plugin: string) => void
}