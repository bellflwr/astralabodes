import type { Object3D } from "three";

export class ModuleKind {
    name: string;
    model: Object3D;
    connectable_sides: Array<boolean>;

    constructor(
        name: string,
        model: Object3D,
        connectable_sides: Array<boolean> = [
            false,
            false,
            false,
            false,
            false,
            false,
        ]
    ) {
        this.name = name;
        this.connectable_sides = connectable_sides;
        this.model = model;
    }
}
