import type { Object3D } from "three";
import type { Module } from "./module";


export class Modules {
    group: Object3D;
    modules: Array<Module> = [];

    constructor(group: Object3D) {
        this.group = group;
    }

    add_module(mod: Module) {
        this.modules.push(mod);
        this.group.add(mod.object);

        
    }
}
