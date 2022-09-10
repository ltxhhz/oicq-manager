import type { Manager } from "./manager"

export abstract class Plugin {
  /** 插件id，不得和其他插件重复 */
  abstract id: string
  /** 显示的名字，不提供则默认为id */
  abstract label?: string
  /** 插件安装函数 */
  abstract install: (manager: Manager) => Promise<void>
  abstract uninstall?: () => Promise<void>
  /** 在列表中 bot 上启用，不提供则全部启用 */
  abstract enableList?: number[]
}
