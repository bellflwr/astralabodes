import type { Object3D } from "three";
import type { Module } from "./module";


export class Modules {
    group: Object3D;
    modules: Array<Module> = [];

    constructor(group: Object3D) {
        this.group = group;
    }
}
