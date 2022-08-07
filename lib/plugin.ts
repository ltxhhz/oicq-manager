import type { Client } from "oicq"
import type { Manager } from "./manager"

export abstract class Plugin {
  /** 插件id，不得和其他插件重复 */
  id: string
  /** 显示的名字，不提供则默认为id */
  label?: string
  /** 插件安装函数 */
  install: (manager: Manager) => void
  /** 在列表中 bot 上启用，不提供则全部启用 */
  enableList?: number[]
  constructor({ id, label, install, enableList }: Plugin) {
    this.id = id
    this.label = label || id
    this.install = install
    this.enableList = enableList
  }
}
