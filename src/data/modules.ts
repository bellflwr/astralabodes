import { Object3D } from "three";
import type { Module } from "./module";
import { SpecType } from "./specializations";


export class Modules {
    group: Object3D;
    modules: Array<Module> = [];
    hitboxes: Object3D;
    specs: Map<SpecType, number> = new Map();

    constructor(group: Object3D) {
        this.group = group;
        this.hitboxes = new Object3D();
        
    }

    add_module(mod: Module) {
        this.modules.push(mod);
        this.group.add(mod.object);
        this.hitboxes.add(mod.hitbox);
    }

    calculate_specs() {
        this.specs.clear();
        for (const i of Object.values(SpecType)) {
            this.specs.set(i, 0);
        }

        for (const mod of this.modules) {
            this.specs.set(mod.spec, this.specs.get(mod.spec) + mod.kind.work_area);
        }

        console.log(this.specs);
    }
}
