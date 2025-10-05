import { Color, MeshStandardMaterial, type Object3D } from "three";
import type { Module } from "./data/module";

export function setPreviewTint(obj: Object3D, ok: boolean) {
    obj.traverse((child: any) => {
        if (child.isMesh) {
            const mat =
                child.material && child.material.clone
                    ? child.material.clone()
                    : new MeshStandardMaterial();
            if (mat.color) {
                mat.color.set(ok ? 0x00ff00 : 0xff0000);
                mat.transparent = true;
                mat.opacity = 0.6;
                if ("emissive" in mat)
                    mat.emissive.set(ok ? 0x003300 : 0x330000);
            }
            child.material = mat;
        }
    });
}

/* ---------- Trash helpers ---------- */
// Highlight a module for trash hover (red), and allow clearing later
export function tintModuleForTrash(mod: Module, on: boolean) {
    mod.object.traverse((child: any) => {
        if (!child.isMesh) return;
        if (on) {
            if (!child.userData._origMat) {
                child.userData._origMat = child.material;
            }
            const mat = new MeshStandardMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.6,
                emissive: new Color(0x330000),
            });
            child.material = mat;
        } else {
            if (child.userData._origMat) {
                child.material = child.userData._origMat;
                child.userData._origMat = null;
            }
        }
    });
}
