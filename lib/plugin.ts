import type { Client } from "oicq"

// export interface Plugin {
//   id: string,
//   label: string,
//   // permissions: Permissions[],
//   func: (bot: Client) => void
// }

export class Plugin {
  /** 插件id，传入包名则为包名(因为npm包名不会重复) */
  id: string
  /** 显示的名字 */
  label: string
  /** 功能函数 */
  function: (bot: Client) => void
  constructor({ id, label, function: func }: Plugin) {
    if (id && label && func) {
      this.id = id
      this.label = label
      this.function = func
    } else {
      throw new Error('Plugin failed to initialize because the constructor received an undefined value')
    }
  }
}
