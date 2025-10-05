// ...existing code...
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { kinds, load_kinds } from "./module_kinds";
import { Modules } from "./data/modules";
import { Object3D } from "three";
import { Module } from "./data/module";
import { Side, direction_vectors } from "./data/sides";
import { SpecType } from "./data/specializations";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(20, 20, 0);

/* ============================
   Placement Helpers (NEW)
============================ */
const faceFromNormalOnTarget = (n: THREE.Vector3): Side => {
  // Map target cube face normal to Side enum
  if (Math.abs(n.x) > 0.9) return n.x > 0 ? Side.RIGHT : Side.LEFT;
  if (Math.abs(n.y) > 0.9) return n.y > 0 ? Side.TOP   : Side.BOTTOM;
  if (Math.abs(n.z) > 0.9) return n.z > 0 ? Side.FRONT : Side.BACK;
  return Side.FRONT; // fallback
};

const isPlacementAllowed = (targetMod: Module | undefined, faceNormal: THREE.Vector3): boolean => {
  if (!targetMod) return false;
  const side = faceFromNormalOnTarget(faceNormal.clone().round());
  const arr = targetMod.kind.connectable_sides || [];
  return !!arr[side];
};

const setPreviewTint = (obj: THREE.Object3D, ok: boolean) => {
  obj.traverse((child: any) => {
    if (child.isMesh) {
      const mat = child.material && child.material.clone ? child.material.clone() : new THREE.MeshStandardMaterial();
      if (mat.color) {
        mat.color.set(ok ? 0x00ff00 : 0xff0000); // green / red
        mat.transparent = true;
        mat.opacity = 0.6;
        if ('emissive' in mat) mat.emissive.set(ok ? 0x003300 : 0x330000);
      }
      child.material = mat;
    }
  });
};
/* ============================ */

let building = 0;
let previewModule: Module | null = null;
let previewModules: THREE.Object3D[] = [];
let previewPosition: THREE.Vector3 | null = null;
let previewNormal: THREE.Vector3 | null = null;
let trashMode = false;
let trashPreview: THREE.Object3D | null = null;

let selectedModule: Module | null = null;

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

const moduleModal = document.getElementById("module-modal") as HTMLElement;

moduleModal.addEventListener("click", (e) => {
    if (e.target === moduleModal) {
        moduleModal.classList.add("modal-hidden");
    }
});

const specSelector = document.getElementById("spec-selector") as HTMLElement;

for(const [k, v] of Object.entries(SpecType)) {
    specSelector.innerHTML += "<div>";
    specSelector.innerHTML += `<input type="radio" name="spectype" id="${k}-radio" value="${v}" />`
    specSelector.innerHTML += `<label for="${k}-radio">${k}</label>`
    specSelector.innerHTML += "</div>";
}

const specButtons = document.querySelectorAll('input[name="spectype"]');

for (let rb of specButtons) {
    rb.addEventListener("change", (e: any) => {
        if(e.target.checked && selectedModule) {
            selectedModule.spec = e.target.value;
        }
    });
}

renderer.domElement.addEventListener("pointerdown", (event) => {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (trashMode) {
        console.log("Trash on");
        const intersects = raycaster.intersectObject(modules.hitboxes, true);
        if (intersects.length && intersects[0].object) {
            console.log("Trash hit");
            let obj: any = intersects[0].object;
            let mod = obj.module_data as Module;
            if (mod) modules.trash(mod);
        }
        trashMode = false;
        return;
    }

    if (!building) {
        const intersects = raycaster.intersectObject(modules.hitboxes, true);
        if (intersects.length > 0) {
            transitionTarget.copy((intersects[0].object as any).position);
            transitioning = true;
            selectedModule = (intersects[0].object as any).module_data;
            if (selectedModule) {
              (specButtons as any)[selectedModule.spec].checked = true;
            }
        }
    } else {
        /* ====== NEW: placement allowed check before committing ====== */
        const intersects = raycaster.intersectObject(modules.hitboxes, true);
        if (!(intersects.length && intersects[0].face)) return;

        const obj: any = intersects[0].object;
        const normal: THREE.Vector3 = intersects[0].face.normal;
        const targetForAdd = obj.module_data as Module | undefined;

        const okAdd = isPlacementAllowed(targetForAdd, normal);
        if (!okAdd) {
            console.log("❌ Invalid placement — this face cannot connect");
            return;
        }
        /* ============================================================ */

        // Place all preview modules in the scene as real modules
        if (previewModules.length > 0) {
            previewModules.forEach(preObj => {
                let kind = kinds.get("Module " + building);
                if (!kind) return;
                let placedModule = new Module(kind);
                placedModule.position = preObj.position.clone();
                placedModule.object.position.copy(preObj.position);
                placedModule.object.rotation.copy(preObj.rotation);
                placedModule.object.scale.copy(preObj.scale);
                if ((preObj as any).userData?.primary_dir) placedModule.primary_dir = (preObj as any).userData.primary_dir;
                if ((preObj as any).userData?.secondary_dir) placedModule.secondary_dir = (preObj as any).userData.secondary_dir;
                modules.add_module(placedModule);
            });
            // Remove all preview objects
            previewModules.forEach(p => scene.remove(p));
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

    // Not building? no preview
    if (!building) return;

    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(modules.hitboxes, true);

    if (intersects.length && intersects[0].face) {
        let obj: any = intersects[0].object;
        let normal = intersects[0].face.normal;
        // Offset by 12 in the face normal direction (your 12-unit module grid)
        let pos = new THREE.Vector3(
          obj.position.x + normal.x * 12,
          obj.position.y + normal.y * 12,
          obj.position.z + normal.z * 12
        );

        if (building >= 1) {
            const kind = kinds.get(`Module ${building}`);
            if (kind) {
                const preview = new Module(kind);
                preview.position = pos.clone();

                // Set orientation based on normal (keep your logic)
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

                // Tint preview based on allowed/blocked face
                const targetMod = obj.module_data as Module | undefined;
                const ok = isPlacementAllowed(targetMod, normal);
                setPreviewTint(preview.object, ok);

                scene.add(preview.object);
                previewModules.push(preview.object);

                // Optional: second preview for Module 2 (inverted visual)
                if (building === 2) {
                    const invertedPreview = new Module(kind);
                    invertedPreview.position = new THREE.Vector3(
                        pos.x + normal.x * 12,
                        pos.y + normal.y * 12,
                        pos.z + normal.z * 12
                    );
                    invertedPreview.primary_dir = preview.primary_dir;
                    invertedPreview.secondary_dir = preview.secondary_dir;
                    invertedPreview.object.scale.x *= -1;

                    // Tint inverted preview too (same ok)
                    setPreviewTint(invertedPreview.object, ok);

                    scene.add(invertedPreview.object);
                    previewModules.push(invertedPreview.object);
                }
            }
        }
    } else {
        // No hover -> no preview
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

    // (We no longer recolor previews here; tint happens in mousemove)

    controls.update();
    renderer.render(scene, camera);
}

// UI Interactivity for Evaluate button, Crew Modal, and Module 1
const trashBtn = document.getElementById("trash-btn") as HTMLButtonElement;
const evaluateBtn = document.getElementById("evaluate-btn") as HTMLButtonElement;
const crewModal = document.getElementById("crew-modal") as HTMLDivElement;
const crewBtns = document.querySelectorAll(".crew-btn");
const module1Btn = document.querySelectorAll(".module-btn")[0] as HTMLButtonElement;
const module2Btn = document.querySelectorAll(".module-btn")[1] as HTMLButtonElement;
const module3Btn = document.querySelectorAll(".module-btn")[2] as HTMLButtonElement;
const module4Btn = document.querySelectorAll(".module-btn")[3] as HTMLButtonElement;
const module5Btn = document.querySelectorAll(".module-btn")[4] as HTMLButtonElement;
const module6Btn = document.querySelectorAll(".module-btn")[5] as HTMLButtonElement;
const module7Btn = document.querySelectorAll(".module-btn")[6] as HTMLButtonElement;
const module8Btn = document.querySelectorAll(".module-btn")[7] as HTMLButtonElement;

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
            console.log("Selected crew size:", size);
            crewModal.classList.add("modal-hidden");
        });
    });
    crewModal.addEventListener("click", (e) => {
        if (e.target === crewModal) {
            crewModal.classList.add("modal-hidden");
        }
    });
}

if (trashBtn){
    trashBtn.addEventListener("click", () => {
        trashMode = !trashMode;
    });
}

if (module1Btn) {
    module1Btn.addEventListener("click", () => {
        building = 1;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module2Btn) {
    module2Btn.addEventListener("click", () => {
        building = 2;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module3Btn) {
    module3Btn.addEventListener("click", () => {
        building = 3;
        console.log("3");
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module4Btn) {
    module4Btn.addEventListener("click", () => {
        building = 4;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module5Btn) {
    module5Btn.addEventListener("click", () => {
        building = 5;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module6Btn) {
    module6Btn.addEventListener("click", () => {
        building = 6;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module7Btn) {
    module7Btn.addEventListener("click", () => {
        building = 7;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

if (module8Btn) {
    module8Btn.addEventListener("click", () => {
        building = 8;
        if (previewModule) {
            scene.remove(previewModule.object);
            previewModule = null;
        }
    });
}

let problems_box: HTMLElement = document.getElementById("problems-box");
problems_box.addEventListener("click", (ev) => {
    problems_box.classList.toggle("open");
});
