"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugin = void 0;
class Plugin {
    constructor({ id, label, install, enableList }) {
        if (id && label && install) {
            this.id = id;
            this.label = label;
            this.install = install;
            this.enableList = enableList;
        }
        else {
            throw new Error('Plugin failed to initialize because the constructor received an undefined value');
        }
    }
}
exports.Plugin = Plugin;
