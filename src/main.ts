// ...existing code...
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { kinds, load_kinds } from "./module_kinds";
import { Modules } from "./data/modules";
import { Object3D } from "three";
import { Module } from "./data/module";
import { Side } from "./data/sides";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(20, 20, 0);

let building = 0;
let previewModule: Module | null = null;
let previewPosition: THREE.Vector3 | null = null;
let previewNormal: THREE.Vector3 | null = null;

const loader = new THREE.TextureLoader();
const texture = loader.load(
    './public/images/milky_way_skybox.jpg',
    () => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
    }
)


const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

let transitioning = false;
let transitionTarget = new THREE.Vector3();
const transitionSpeed = 0.1;

const controls = new OrbitControls(camera, renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);

const point_light_color = 0xffffff;
const point_light_intensity = 3;

const ambient_light_color = 0xffffff;
const ambient_light_intensity = 1;

const light = new THREE.DirectionalLight(
    point_light_color,
    point_light_intensity
);
light.position.set(-1, 2, 4);
scene.add(light);

const ambient_light = new THREE.AmbientLight(
    ambient_light_color,
    ambient_light_intensity
);
scene.add(ambient_light);

let mod_group: Object3D = new Object3D();
scene.add(mod_group);
let modules: Modules = new Modules(mod_group);
scene.add(modules.hitboxes);

load_kinds(() => {
    let m = new Module(kinds.get("Module 1"));
    m.position = new THREE.Vector3(0, 0, 0);
    modules.add_module(m);
    console.log(m.object.rotation);
    m.primary_dir = Side.FRONT;
    m.secondary_dir = Side.LEFT;
    console.log(m.object.rotation);

});

renderer.domElement.addEventListener("pointerdown", (event) => {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (!building) {
        const intersects = raycaster.intersectObject(cube);
        if (intersects.length > 0) {
            transitionTarget.copy(cube.position);
            transitioning = true;
        }
    } else {
        const intersects = raycaster.intersectObject(modules.hitboxes);
        if (intersects.length && previewModule) {
            let obj = intersects[0].object;
            let normal = intersects[0].face.normal;
            let pos = new THREE.Vector3(obj.position.x + normal.x * 12, obj.position.y + normal.y * 12, obj.position.z + normal.z * 12);
            let module = new Module(kinds.get("Module " + building));
            module.position = pos;
            // Default directions
            if (normal.x === 1) {
                module.primary_dir = Side.LEFT;
                module.secondary_dir = Side.FRONT;
            } else if (normal.x === -1) {
                module.primary_dir = Side.RIGHT;
                module.secondary_dir = Side.FRONT;
            } else if (normal.y === 1) {
                module.primary_dir = Side.BOTTOM;
                module.secondary_dir = Side.FRONT;
            } else if (normal.y === -1) {
                module.primary_dir = Side.TOP;
                module.secondary_dir = Side.FRONT;
            } else if (normal.z === 1) {
                module.primary_dir = Side.BACK;
                module.secondary_dir = Side.TOP;
            } else if (normal.z === -1) {
                module.primary_dir = Side.FRONT;
                module.secondary_dir = Side.TOP;
            }

            // Invert module 2 if placed on another module 2
            if (building === 2 && obj.parent && obj.parent.parent) {
                const targetModule = modules.modules.find(m => m.hitbox === obj);
                if (targetModule && targetModule.kind.name === "Module 2") {
                    // Mirror along X axis for smooth blend
                    module.object.scale.x *= -1;
                }
            }
            // Remove preview and restore original materials
            if (previewModule) {
                scene.remove(previewModule.object);
                previewModule = null;
            }
            modules.add_module(module);
            building = 0;
            building = 0;
        }
    }
});
// Mouse move handler for preview
renderer.domElement.addEventListener("mousemove", (event) => {
    if (!building) return;
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(modules.hitboxes);
    if (intersects.length) {
        let obj = intersects[0].object;
        let normal = intersects[0].face.normal;
        let pos = new THREE.Vector3(obj.position.x + normal.x * 12, obj.position.y + normal.y * 12, obj.position.z + normal.z * 12);
        previewPosition = pos;
        previewNormal = normal.clone();
        // Set preview rotation here
        if (previewModule) {
            const EPS = 0.99;
            if (normal.x === 1) {
                previewModule.primary_dir = Side.LEFT;
                previewModule.secondary_dir = Side.FRONT;
            } else if (normal.x === -1) {
                previewModule.primary_dir = Side.RIGHT;
                previewModule.secondary_dir = Side.FRONT;
            } else if (normal.y === 1) {
                previewModule.primary_dir = Side.BOTTOM;
                previewModule.secondary_dir = Side.FRONT;
            } else if (normal.y === -1) {
                previewModule.primary_dir = Side.TOP;
                previewModule.secondary_dir = Side.FRONT;
            } else if (normal.z === 1) {
                previewModule.primary_dir = Side.BACK;
                previewModule.secondary_dir = Side.TOP;
            } else if (normal.z === -1) {
                previewModule.primary_dir = Side.FRONT;
                previewModule.secondary_dir = Side.TOP;
            }
        }
    } else {
        previewPosition = null;
        previewNormal = null;
    }
});
camera.position.z = 5;


function animate() {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    if (transitioning) {
        controls.target.lerp(transitionTarget, transitionSpeed);
        if (controls.target.distanceTo(transitionTarget) < 0.01) {
            controls.target.copy(transitionTarget);
            transitioning = false;
        }
    }

    // Preview module logic
    if (building && previewPosition) {
        if (!previewModule) {
            previewModule = new Module(kinds.get("Module " + building));
            previewModule.object.traverse(child => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const makeGreen = (mat: THREE.Material) => {
                        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
                            return new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
                        }
                        return mat;
                    };
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(makeGreen);
                    } else {
                        mesh.material = makeGreen(mesh.material);
                    }
                }
            });
            scene.add(previewModule.object);
        }
        previewModule.position = previewPosition.clone();
    } else if (previewModule) {
        scene.remove(previewModule.object);
        previewModule = null;
    }

    controls.update();
    renderer.render(scene, camera);
}

// UI Interactivity for Evaluate button, Crew Modal, and Module 1
const evaluateBtn = document.getElementById("evaluate-btn") as HTMLButtonElement;
const crewModal = document.getElementById("crew-modal") as HTMLDivElement;
const crewBtns = document.querySelectorAll(".crew-btn");
const module1Btn = document.querySelectorAll(".module-btn")[0] as HTMLButtonElement;
const module2Btn = document.querySelectorAll(".module-btn")[1] as HTMLButtonElement;

// Ensure modal is hidden on page load
if (crewModal) {
    crewModal.classList.add("modal-hidden");
}

if (evaluateBtn && crewModal) {
    evaluateBtn.addEventListener("click", () => {
        crewModal.classList.remove("modal-hidden");
    });
    crewBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const size = (e.target as HTMLButtonElement).dataset.size;
            // You can handle the selected crew size here
            console.log("Selected crew size:", size);
            crewModal.classList.add("modal-hidden");
        });
    });
    // Optional: close modal when clicking outside modal-content
    crewModal.addEventListener("click", (e) => {
        if (e.target === crewModal) {
            crewModal.classList.add("modal-hidden");
        }
    });
}

if (module1Btn) {
    module1Btn.addEventListener("click", () => {
        building = 1;
        // Remove any previous preview
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module2Btn) {
    module2Btn.addEventListener("click", () => {
        building = 2;
        // Remove any previous preview
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}
