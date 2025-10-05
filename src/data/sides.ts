import { Euler, Matrix4, Quaternion, Vector3 } from "three";

const Side = {
    TOP: 0,
    BOTTOM: 1,
    LEFT: 2,
    RIGHT: 3,
    FRONT: 4,
    BACK: 5,
} as const;

type Side = (typeof Side)[keyof typeof Side];

export { Side };

export const direction_vectors: Array<Vector3> = [
    new Vector3(0, 1, 0),
    new Vector3(0, -1, 0),
    new Vector3(-1, 0, 0),
    new Vector3(1, 0, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, -1),
];

export function get_side_from_vector(vec: Vector3): Side {
    const norm = vec.normalize();
    if (norm.x === 1) {
        return Side.RIGHT;
    } else if (norm.x === -1) {
        return Side.LEFT;
    } else if (norm.y === 1) {
        return Side.TOP;
    } else if (norm.y === -1) {
        return Side.BOTTOM;
    } else if (norm.z === 1) {
        return Side.FRONT;
    } else if (norm.z === -1) {
        return Side.BACK;
    }
    return Side.RIGHT;
}

export function get_euler_from_directions(u: Vector3, v: Vector3) {
    // u and v are THREE.Vector3 objects (unit, orthogonal, cardinal)

    // Ensure right-handed system
    const w = new Vector3().crossVectors(u, v);

    // Build rotation matrix with columns [u v w]
    const m = new Matrix4();
    m.set(u.x, v.x, w.x, 0, u.y, v.y, w.y, 0, u.z, v.z, w.z, 0, 0, 0, 0, 1);

    // Create a quaternion from the matrix
    const q = new Quaternion().setFromRotationMatrix(m);

    // Convert quaternion to Euler (XYZ order)
    const euler = new Euler().setFromQuaternion(q, "XYZ");

    return euler; // returns Euler angles in radians
}

/* ============================
   Placement + Trash Helpers
============================ */
export function faceFromNormalOnTarget(n: Vector3): Side {
    if (Math.abs(n.x) > 0.9) return n.x > 0 ? Side.RIGHT : Side.LEFT;
    if (Math.abs(n.y) > 0.9) return n.y > 0 ? Side.TOP : Side.BOTTOM;
    if (Math.abs(n.z) > 0.9) return n.z > 0 ? Side.FRONT : Side.BACK;
    return Side.FRONT;
}

// Determine side from delta between centers (world aligned grid, 12 units apart)
export function sideFromDelta(delta: Vector3): Side | null {
    const eps = 1e-3;
    const ax = Math.abs(delta.x);
    const ay = Math.abs(delta.y);
    const az = Math.abs(delta.z);
    if (ax > ay && ax > az && Math.abs(ax - 12) < eps) {
        return delta.x > 0 ? Side.RIGHT : Side.LEFT;
    }
    if (ay > ax && ay > az && Math.abs(ay - 12) < eps) {
        return delta.y > 0 ? Side.TOP : Side.BOTTOM;
    }
    if (az > ax && az > ay && Math.abs(az - 12) < eps) {
        return delta.z > 0 ? Side.FRONT : Side.BACK;
    }
    return null;
}
