// import type { PluginError, PluginInstallError } from "./errors"




export interface EventMap<T = any> {
  'plugin-installed': (this: T, plugin: string) => void
  'plugin-install-error': (this: T, plugin: string, error: Error) => void
  'plugin-error': (this: T, plugin: string, error: Error) => void
  'plugin-uninstalled': (this: T, plugin: string) => void
}