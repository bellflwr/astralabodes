import { Vector3 } from "three";
import type { ModuleKind } from "./module_kind";
import { Side } from "./sides";


export class Module {
    position: Vector3 = new Vector3(0, 0, 0);
    orientation: Side = Side.FRONT;
    rotation: number = 0;
    kind: ModuleKind;

    constructor(kind: ModuleKind) {
        this.kind = kind;
    }
}
