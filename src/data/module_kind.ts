import type { Object3D } from "three";

export class ModuleKind {
    name: string;
    model: Object3D;
    connectable_sides: Array<boolean>;
    work_area: number;

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
        ],
        work_area: number
    ) {
        this.name = name;
        this.connectable_sides = connectable_sides;
        this.model = model;
        this.work_area = work_area;
    }
}
