import { Object3D } from "three";
import { ModuleKind } from "./data/module_kind";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const gltfLoader = new GLTFLoader();

export let kinds: Array<ModuleKind> = []
gltfLoader.load("/models/Debug_Module.glb", (gltf) => {
    kinds.push(new ModuleKind("Debug", gltf.scene))
});

// let debug_cross_model = new Object3D();
// debug_cross_model.add()