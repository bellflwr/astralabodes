// ...existing code...
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { kinds, load_kinds } from "./module_kinds";
import { Modules } from "./data/modules";
import { Object3D } from "three";
import { Module } from "./data/module";
import { Side, direction_vectors } from "./data/sides";

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
let previewModules: THREE.Object3D[] = [];
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
            // Place all preview modules in the scene as real modules
            if (previewModules.length > 0) {
                previewModules.forEach(obj => {
                    // Find the Module instance for this preview object
                    // (Assume each preview object is a Module.object)
                    // We'll reconstruct the Module from the preview object
                    // by copying its position, orientation, and mirroring
                    let kind = building === 1 ? kinds.get("Module 1") : kinds.get("Module 2");
                    if (!kind) return;
                    let placedModule = new Module(kind);
                    placedModule.position = obj.position;
                    placedModule.object.position.copy(obj.position);
                    placedModule.object.rotation.copy(obj.rotation);
                    placedModule.object.scale.copy(obj.scale);
                    // Try to copy orientation if available
                    if (obj.userData.primary_dir) placedModule.primary_dir = obj.userData.primary_dir;
                    if (obj.userData.secondary_dir) placedModule.secondary_dir = obj.userData.secondary_dir;
                    modules.add_module(placedModule);
                });
                // Remove all preview objects
                previewModules.forEach(obj => scene.remove(obj));
                previewModules = [];
                building = 0;
            }
    }
});
// Mouse move handler for preview
renderer.domElement.addEventListener("mousemove", (event) => {
    // Remove previous preview modules
    if (previewModules.length > 0) {
        previewModules.forEach(obj => scene.remove(obj));
        previewModules = [];
    }
    // --- RESTARTED PREVIEW SYSTEM ---
    // Remove all previews if not in building mode
    if (!building) {
        if (previewModules.length > 0) {
            previewModules.forEach(obj => scene.remove(obj));
            previewModules = [];
        }
        return;
    }
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(modules.hitboxes);
    if (intersects.length && intersects[0].face) {
        let obj = intersects[0].object;
        let normal = intersects[0].face.normal;
        let pos = new THREE.Vector3(obj.position.x + normal.x * 12, obj.position.y + normal.y * 12, obj.position.z + normal.z * 12);
        // Remove previous previews
        if (previewModules.length > 0) {
            previewModules.forEach(obj => scene.remove(obj));
            previewModules = [];
        }
        if (building === 1) {
            const kind1 = kinds.get("Module 1");
            if (kind1) {
                const preview = new Module(kind1);
                preview.position = pos.clone();
                // Set orientation based on normal
                if (normal.x === 1) {
                    preview.primary_dir = Side.LEFT;
                    preview.secondary_dir = Side.FRONT;
                } else if (normal.x === -1) {
                    preview.primary_dir = Side.RIGHT;
                    preview.secondary_dir = Side.FRONT;
                } else if (normal.y === 1) {
                    preview.primary_dir = Side.BOTTOM;
                    preview.secondary_dir = Side.FRONT;
                } else if (normal.y === -1) {
                    preview.primary_dir = Side.TOP;
                    preview.secondary_dir = Side.FRONT;
                } else if (normal.z === 1) {
                    preview.primary_dir = Side.BACK;
                    preview.secondary_dir = Side.TOP;
                } else if (normal.z === -1) {
                    preview.primary_dir = Side.FRONT;
                    preview.secondary_dir = Side.TOP;
                }
                preview.object.traverse(child => {
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
                scene.add(preview.object);
                previewModules.push(preview.object);
            }
        } else if (building === 2) {
            const kind2 = kinds.get("Module 2");
            if (kind2) {
                // Normal preview
                const normalPreview = new Module(kind2);
                normalPreview.position = pos.clone();
                if (normal.x === 1) {
                    normalPreview.primary_dir = Side.LEFT;
                    normalPreview.secondary_dir = Side.FRONT;
                } else if (normal.x === -1) {
                    normalPreview.primary_dir = Side.RIGHT;
                    normalPreview.secondary_dir = Side.FRONT;
                } else if (normal.y === 1) {
                    normalPreview.primary_dir = Side.BOTTOM;
                    normalPreview.secondary_dir = Side.FRONT;
                } else if (normal.y === -1) {
                    normalPreview.primary_dir = Side.TOP;
                    normalPreview.secondary_dir = Side.FRONT;
                } else if (normal.z === 1) {
                    normalPreview.primary_dir = Side.BACK;
                    normalPreview.secondary_dir = Side.TOP;
                } else if (normal.z === -1) {
                    normalPreview.primary_dir = Side.FRONT;
                    normalPreview.secondary_dir = Side.TOP;
                }
                normalPreview.object.traverse(child => {
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
                scene.add(normalPreview.object);
                previewModules.push(normalPreview.object);
                // Inverted preview, 1 unit along normal
                const invertedPreview = new Module(kind2);
                invertedPreview.position = new THREE.Vector3(
                    pos.x + normal.x * 12,
                    pos.y + normal.y * 12,
                    pos.z + normal.z * 12
                );
                invertedPreview.primary_dir = normalPreview.primary_dir;
                invertedPreview.secondary_dir = normalPreview.secondary_dir;
                invertedPreview.object.scale.x *= -1;
                invertedPreview.object.traverse(child => {
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
                scene.add(invertedPreview.object);
                previewModules.push(invertedPreview.object);
            }
        }
    } else {
        // Remove all previews if not hovering
        if (previewModules.length > 0) {
            previewModules.forEach(obj => scene.remove(obj));
            previewModules = [];
        }
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
        // Remove previous preview
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
        if (building === 2) {
            const kind2 = kinds.get("Module 2");
            if (kind2) {
                // Normal preview
                const normalPreview = new Module(kind2);
                normalPreview.position = previewPosition.clone();
                normalPreview.primary_dir = Side.FRONT;
                normalPreview.secondary_dir = Side.TOP;
                normalPreview.object.traverse(child => {
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
                scene.add(normalPreview.object);
                // Inverted preview
                const invertedPreview = new Module(kind2);
                const dirVec = direction_vectors[normalPreview.primary_dir];
                invertedPreview.position = previewPosition.clone().addScaledVector(dirVec, -12);
                invertedPreview.primary_dir = normalPreview.primary_dir;
                invertedPreview.secondary_dir = normalPreview.secondary_dir;
                invertedPreview.object.scale.x *= -1;
                invertedPreview.object.traverse(child => {
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
                scene.add(invertedPreview.object);
                // Store reference to remove later
                previewModule = normalPreview;
                // Store inverted as property for removal
                (previewModule as any).inverted = invertedPreview;
            }
        } else {
            previewModule = new Module(kinds.get("Module " + building));
            previewModule.position = previewPosition.clone();
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
    } else if (previewModule) {
        // Remove both preview objects if module 2
        if ((previewModule as any).inverted) {
            scene.remove((previewModule as any).inverted.object);
        }
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

let problems_box: HTMLElement = document.getElementById("problems-box");

problems_box.addEventListener("click", (ev) => {
    problems_box.classList.toggle("open");
})