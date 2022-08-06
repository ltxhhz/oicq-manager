import type { Client } from "oicq"

export interface Plugin {
  /** 插件id，不得和其他插件重复 */
  id: string
  /** 显示的名字，不提供则默认为id */
  label?: string
  /** 插件安装函数 */
  install: (bot: Client) => void
  /** 在列表中 bot 上启用，不提供则全部启用 */
  enableList?: number[]
}
