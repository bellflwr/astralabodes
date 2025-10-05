import { Object3D, Vector3 } from "three";
import type { Module } from "./module";
import { SpecType } from "./specializations";
import { Side, sideFromDelta } from "./sides";

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
            this.specs.set(
                mod.spec,
                this.specs.get(mod.spec) + mod.kind.work_area
            );
        }

        console.log(this.specs);
    }

    trash(mod: Module) {
        this.group.remove(mod.object);
        this.hitboxes.remove(mod.hitbox);
        const index = this.modules.indexOf(mod);
        if (index !== -1) {
            this.modules.splice(index, 1);
        }
    }
}

// For a given module, list neighbors exactly 12 units away along one axis, honoring connectable_sides
export function getNeighbors(
    modules_obj: Modules,
    mod: Module
): Array<{ neighbor: Module; sideOnMod: Side; sideOnNei: Side }> {
    const out: Array<{ neighbor: Module; sideOnMod: Side; sideOnNei: Side }> =
        [];
    for (const other of modules_obj.modules) {
        if (other === mod) continue;
        const delta = new Vector3().subVectors(other.position, mod.position);
        const sideOnMod = sideFromDelta(delta);
        if (sideOnMod === null) continue;
        const opposite = (s: Side): Side => {
            switch (s) {
                case Side.TOP:
                    return Side.BOTTOM;
                case Side.BOTTOM:
                    return Side.TOP;
                case Side.LEFT:
                    return Side.RIGHT;
                case Side.RIGHT:
                    return Side.LEFT;
                case Side.FRONT:
                    return Side.BACK;
                case Side.BACK:
                    return Side.FRONT;
            }
        };
        const sideOnNei = opposite(sideOnMod);
        const okAB = !!mod.kind.connectable_sides?.[sideOnMod];
        const okBA = !!other.kind.connectable_sides?.[sideOnNei];
        if (okAB && okBA) {
            out.push({ neighbor: other, sideOnMod, sideOnNei });
        }
    }
    return out;
}

// Special: for Module 2, find its "back" neighbor (world -Z)
export function getBackNeighborForModule2(
    modules_obj: Modules,
    mod2: Module
): Module | null {
    const backPos = mod2.position.clone().add(new Vector3(0, 0, -12));
    const eps = 1e-3;
    for (const other of modules_obj.modules) {
        if (other === mod2) continue;
        if (other.position.distanceTo(backPos) < eps) {
            const delta = new Vector3().subVectors(
                other.position,
                mod2.position
            );
            const sideOnMod = sideFromDelta(delta);
            if (sideOnMod === Side.BACK) {
                const okAB = !!mod2.kind.connectable_sides?.[Side.BACK];
                const okBA = !!other.kind.connectable_sides?.[Side.FRONT];
                if (okAB && okBA) return other;
            }
        }
    }
    return null;
}
