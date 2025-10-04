import { Object3D } from "three";
import type { Module } from "./module";


export class Modules {
    group: Object3D;
    modules: Array<Module> = [];
    hitboxes: Object3D;

    constructor(group: Object3D) {
        this.group = group;
        this.hitboxes = new Object3D();
        
    }

    add_module(mod: Module) {
        this.modules.push(mod);
        this.group.add(mod.object);
        this.hitboxes.add(mod.hitbox);

        
    }
}
