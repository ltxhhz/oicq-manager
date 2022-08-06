import type { Client } from "oicq";
export declare class Plugin {
    /** 插件id，不得和其他插件重复 */
    id: string;
    /** 显示的名字 */
    label: string;
    /** 插件安装函数 */
    install: (bot: Client) => void;
    /** 在列表中 bot 上启用，不提供则全部启用 */
    enableList?: number[];
    constructor({ id, label, install, enableList }: Plugin);
}
