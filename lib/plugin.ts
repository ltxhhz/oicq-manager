import type { Client } from "oicq"

export class Plugin {
  /** 插件id，不得和其他插件重复 */
  id: string
  /** 显示的名字 */
  label: string
  /** 插件安装函数 */
  install: (bot: Client) => void
  /** 在列表中 bot 上启用，不提供则全部启用 */
  enableList?: number[]
  constructor({ id, label, install, enableList }: Plugin) {
    if (id && label && install) {
      this.id = id
      this.label = label
      this.install = install
      this.enableList = enableList
    } else {
      throw new Error('Plugin failed to initialize because the constructor received an undefined value')
    }
  }
}
