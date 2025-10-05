import { Object3D } from "three";
import { ModuleKind } from "./data/module_kind";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const gltfLoader = new GLTFLoader();

const model_path = "/models/";
const kind_data: Array<any> = [
    ["Debug", "Debug_Module.glb", [false, false, false, false, false, false]],
    ["Module 1", "Module-1.glb", [false, false, true, false, false, false]],
    ["Module 2", "Module-2.glb", [false, false, false, false, false, false]]
];

export let kinds: Map<string, ModuleKind> = new Map();
export function load_kinds(callback: () => void) {
    let i = kind_data.length;

    for (const el of kind_data) {
        gltfLoader.load(model_path + el[1], (gltf) => {
            kinds.set(el[0], new ModuleKind(el[0], gltf.scene, el[2]));
            i--;
            if (i == 0) {
                callback();
            }
        });
    }
}

// let debug_cross_model = new Object3D();
// debug_cross_model.add()
