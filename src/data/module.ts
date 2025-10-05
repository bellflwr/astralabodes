import { BoxGeometry, MeshBasicMaterial, Mesh, Object3D, Vector3 } from "three";
import { getModuleIndex, type ModuleKind } from "./module_kind";
import {
    direction_vectors,
    faceFromNormalOnTarget,
    get_euler_from_directions,
    Side,
} from "./sides";
import { SpecType } from "./specializations";

export class Module {
    primary_dir_: Side = Side.FRONT;
    secondary_dir_: Side = Side.TOP;
    object: Object3D;
    kind: ModuleKind;
    hitbox: Object3D;

    spec: SpecType = SpecType.Unassigned;

    constructor(kind: ModuleKind) {
        this.kind = kind;

        this.object = this.kind.model.clone();

        const geo = new BoxGeometry(12, 12, 12);
        const mat = new MeshBasicMaterial({ visible: false });
        this.hitbox = new Mesh(geo, mat);
        this.hitbox.module_data = this;
    }

    get primary_dir(): Side {
        return this.primary_dir_;
    }

    set primary_dir(value: Side) {
        this.primary_dir_ = value;

        this.object.setRotationFromEuler(
            get_euler_from_directions(
                direction_vectors[this.primary_dir_],
                direction_vectors[this.secondary_dir_]
            )
        );
    }

    get secondary_dir(): Side {
        return this.secondary_dir_;
    }

    set secondary_dir(value: Side) {
        this.secondary_dir_ = value;

        this.object.setRotationFromEuler(
            get_euler_from_directions(
                direction_vectors[this.primary_dir_],
                direction_vectors[this.secondary_dir_]
            )
        );
    }

    get position(): Vector3 {
        return this.object.position.clone();
    }

    set position(value: Vector3) {
        this.object.position.copy(value);
        this.hitbox.position.copy(value);
    }
}

/**
 * Placement rule (FRONT of 8):
 * - 3..7 can place on 3..7 only, OR on Module 8's FRONT face
 * - Otherwise, use target connectable_sides
 */
export function isPlacementAllowed(
    targetMod: Module | undefined,
    faceNormal: Vector3,
    placingIndex: number
): boolean {
    if (!targetMod) return false;

    const side = faceFromNormalOnTarget(faceNormal.clone().round());
    const baseOK = !!targetMod.kind.connectable_sides?.[side];
    const targetIndex = getModuleIndex(targetMod);

    // 3..7 behavior
    if (placingIndex >= 3 && placingIndex <= 7) {
        if (targetIndex >= 3 && targetIndex <= 7) return baseOK;
        if (targetIndex === 8) return baseOK && side === Side.FRONT;
        return false;
    }

    // 8 FRONT can accept 1..7
    if (targetIndex === 8 && side === Side.FRONT) {
        return baseOK && placingIndex >= 1 && placingIndex <= 7;
    }

    return baseOK;
}
