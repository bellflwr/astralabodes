// ...existing code...
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { kinds, load_kinds } from "./module_kinds";
import { Modules } from "./data/modules";
import { Object3D } from "three";
import { Module } from "./data/module";
import { Side, get_side_from_vector } from "./data/sides";
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
   Placement + Trash Helpers
============================ */
const faceFromNormalOnTarget = (n: THREE.Vector3): Side => {
  if (Math.abs(n.x) > 0.9) return n.x > 0 ? Side.RIGHT : Side.LEFT;
  if (Math.abs(n.y) > 0.9) return n.y > 0 ? Side.TOP   : Side.BOTTOM;
  if (Math.abs(n.z) > 0.9) return n.z > 0 ? Side.FRONT : Side.BACK;
  return Side.FRONT;
};

const getModuleIndex = (mod?: Module): number => {
  if (!mod) return -1;
  const m = /(\d+)/.exec(mod.kind.name ?? "");
  return m ? parseInt(m[1], 10) : -1;
};

/**
 * Placement rule (FRONT of 8):
 * - 3..7 can place on 3..7 only, OR on Module 8's FRONT face
 * - Otherwise, use target connectable_sides
 */
const isPlacementAllowed = (
  targetMod: Module | undefined,
  faceNormal: THREE.Vector3,
  placingIndex: number
): boolean => {
  if (!targetMod) return false;

  const side = faceFromNormalOnTarget(faceNormal.clone().round());
  const baseOK = !!(targetMod.kind.connectable_sides?.[side]);
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
};

const setPreviewTint = (obj: THREE.Object3D, ok: boolean) => {
  obj.traverse((child: any) => {
    if (child.isMesh) {
      const mat = child.material && child.material.clone ? child.material.clone() : new THREE.MeshStandardMaterial();
      if (mat.color) {
        mat.color.set(ok ? 0x00ff00 : 0xff0000);
        mat.transparent = true;
        mat.opacity = 0.6;
        if ('emissive' in mat) mat.emissive.set(ok ? 0x003300 : 0x330000);
      }
      child.material = mat;
    }
  });
};

/* ---------- Trash helpers ---------- */

// Highlight a module for trash hover (red), and allow clearing later
const tintModuleForTrash = (mod: Module, on: boolean) => {
  mod.object.traverse((child: any) => {
    if (!child.isMesh) return;
    if (on) {
      if (!child.userData._origMat) {
        child.userData._origMat = child.material;
      }
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.6,
        emissive: new THREE.Color(0x330000)
      });
      child.material = mat;
    } else {
      if (child.userData._origMat) {
        child.material = child.userData._origMat;
        child.userData._origMat = null;
      }
    }
  });
};

// Determine side from delta between centers (world aligned grid, 12 units apart)
const sideFromDelta = (delta: THREE.Vector3): Side | null => {
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
};

// For a given module, list neighbors exactly 12 units away along one axis, honoring connectable_sides
const getNeighbors = (modules: Modules, mod: Module): Array<{ neighbor: Module, sideOnMod: Side, sideOnNei: Side }> => {
  const out: Array<{ neighbor: Module, sideOnMod: Side, sideOnNei: Side }> = [];
  for (const other of modules.modules) {
    if (other === mod) continue;
    const delta = new THREE.Vector3().subVectors(other.position, mod.position);
    const sideOnMod = sideFromDelta(delta);
    if (sideOnMod === null) continue;
    const opposite = (s: Side): Side => {
      switch (s) {
        case Side.TOP: return Side.BOTTOM;
        case Side.BOTTOM: return Side.TOP;
        case Side.LEFT: return Side.RIGHT;
        case Side.RIGHT: return Side.LEFT;
        case Side.FRONT: return Side.BACK;
        case Side.BACK: return Side.FRONT;
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
};

// Special: for Module 2, find its "back" neighbor (world -Z)
const getBackNeighborForModule2 = (modules: Modules, mod2: Module): Module | null => {
  const backPos = mod2.position.clone().add(new THREE.Vector3(0, 0, -12));
  const eps = 1e-3;
  for (const other of modules.modules) {
    if (other === mod2) continue;
    if (other.position.distanceTo(backPos) < eps) {
      const delta = new THREE.Vector3().subVectors(other.position, mod2.position);
      const sideOnMod = sideFromDelta(delta);
      if (sideOnMod === Side.BACK) {
        const okAB = !!mod2.kind.connectable_sides?.[Side.BACK];
        const okBA = !!other.kind.connectable_sides?.[Side.FRONT];
        if (okAB && okBA) return other;
      }
    }
  }
  return null;
};

// Protect the original placed module
let rootModule: Module | null = null;

// A module is trashable iff it is NOT the root and touches exactly one neighbor
const canTrash = (modules: Modules, mod: Module): boolean => {
  if (rootModule && mod === rootModule) return false;
  const neighbors = getNeighbors(modules, mod);
  return neighbors.length === 1;
};
/* ================================== */

/* ---------- Flash banner for invalid placement ---------- */
let flashDiv: HTMLDivElement | null = null;
let flashTimer: number | null = null;

const ensureFlashDiv = () => {
  if (flashDiv) return flashDiv;
  flashDiv = document.createElement("div");
  flashDiv.style.position = "fixed";
  flashDiv.style.top = "12px";
  flashDiv.style.left = "50%";
  flashDiv.style.transform = "translateX(-50%)";
  flashDiv.style.padding = "8px 14px";
  flashDiv.style.borderRadius = "8px";
  flashDiv.style.fontFamily = "system-ui, sans-serif";
  flashDiv.style.fontSize = "14px";
  flashDiv.style.color = "#fff";
  flashDiv.style.background = "rgba(220, 0, 0, 0.9)";
  flashDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
  flashDiv.style.zIndex = "9999";
  flashDiv.style.display = "none";
  document.body.appendChild(flashDiv);
  return flashDiv;
};

const showFlash = (msg: string, ms = 1000) => {
  const el = ensureFlashDiv();
  el.textContent = msg;
  el.style.display = "block";
  if (flashTimer) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    if (flashDiv) flashDiv.style.display = "none";
  }, ms);
};
/* -------------------------------------------------------- */

let building = 0;
let previewModule: Module | null = null;
let previewModules: THREE.Object3D[] = [];
let previewPosition: THREE.Vector3 | null = null;
let previewNormal: THREE.Vector3 | null = null;
let trashMode = false;

let selectedModule: Module | null = null;
let trashHoverTargets: Module[] = []; // currently highlighted in trash mode

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
    m.primary_dir = Side.FRONT;
    m.secondary_dir = Side.LEFT;
    rootModule = m; // protect
});

/* ============================
   UI + Events
============================ */

const moduleModal = document.getElementById("module-modal") as HTMLElement;

moduleModal?.addEventListener("click", (e) => {
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
        // clear hover tints
        for (const m of trashHoverTargets) tintModuleForTrash(m, false);
        trashHoverTargets = [];

        const intersects = raycaster.intersectObject(modules.hitboxes, true);
        if (intersects.length && intersects[0].object) {
            const hitObj: any = intersects[0].object;
            const targetMod = hitObj.module_data as Module;
            if (targetMod && canTrash(modules, targetMod)) {
                const idx = getModuleIndex(targetMod);
                if (idx === 2) {
                    const backBuddy = getBackNeighborForModule2(modules, targetMod);
                    modules.trash(targetMod);
                    if (backBuddy) modules.trash(backBuddy);
                } else {
                    modules.trash(targetMod);
                }
            } else {
                console.log("Not deletable (must touch exactly 1 neighbor and not the original).");
            }
        }

        // auto-untoggle after one use
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
        // placement validity check
        const intersects = raycaster.intersectObject(modules.hitboxes, true);
        if (!(intersects.length && intersects[0].face)) return;

        const obj: any = intersects[0].object;
        const normal: THREE.Vector3 = intersects[0].face.normal;
        const targetForAdd = obj.module_data as Module | undefined;

        const okAdd = isPlacementAllowed(targetForAdd, normal, building);
        if (!okAdd) {
            showFlash("You cannot place that there", 1000);
            // clear “hand” (exit building mode and remove previews)
            if (previewModules.length > 0) {
              previewModules.forEach(p => scene.remove(p));
              previewModules = [];
            }
            building = 0;
            return;
        }

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

// Mouse move handler: previews (build) + trash hover
renderer.domElement.addEventListener("mousemove", (event) => {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // TRASH MODE HOVER
    if (trashMode) {
        // clear old highlights
        for (const m of trashHoverTargets) tintModuleForTrash(m, false);
        trashHoverTargets = [];

        const hit = raycaster.intersectObject(modules.hitboxes, true);
        if (hit.length && hit[0].object) {
            const target: any = hit[0].object;
            const mod = target.module_data as Module;
            if (mod && canTrash(modules, mod)) {
                tintModuleForTrash(mod, true);
                trashHoverTargets.push(mod);

                // If Module 2, also highlight the back buddy
                if (getModuleIndex(mod) === 2) {
                    const buddy = getBackNeighborForModule2(modules, mod);
                    if (buddy) {
                        tintModuleForTrash(buddy, true);
                        trashHoverTargets.push(buddy);
                    }
                }
            }
        }
        // In trash mode we don't show placement previews
        if (previewModules.length > 0) {
            previewModules.forEach(obj => scene.remove(obj));
            previewModules = [];
        }
        return;
    }

    // BUILD PREVIEW
    if (previewModules.length > 0) {
        previewModules.forEach(obj => scene.remove(obj));
        previewModules = [];
    }

    if (!building) return;

    const intersects = raycaster.intersectObject(modules.hitboxes, true);

    if (intersects.length && intersects[0].face) {
        let obj: any = intersects[0].object;
        let normal = intersects[0].face.normal;

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

                preview.primary_dir = get_side_from_vector(normal.negate());
                preview.secondary_dir = Side.FRONT;

                if (preview.primary_dir == Side.BACK || preview.primary_dir == Side.FRONT) {
                  preview.secondary_dir = Side.TOP;
                }

                const targetMod = obj.module_data as Module | undefined;
                const ok = isPlacementAllowed(targetMod, normal, building);
                setPreviewTint(preview.object, ok);

                scene.add(preview.object);
                previewModules.push(preview.object);

                // Optional inverted preview for Module 2
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

                    setPreviewTint(invertedPreview.object, ok);

                    scene.add(invertedPreview.object);
                    previewModules.push(invertedPreview.object);
                }
            }
        }
    } else {
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
        // Clicking garbage can toggles mode; when turning off, also clear hover tint
        if (trashMode) {
          for (const m of trashHoverTargets) tintModuleForTrash(m, false);
          trashHoverTargets = [];
        }
        trashMode = !trashMode;
    });
}

const clearPreviewModule = () => {
  if (previewModule) {
    scene.remove(previewModule.object);
    previewModule = null;
  }
};

const setBuilding = (n: number) => {
  building = n;
  clearPreviewModule();
};

if (module1Btn) module1Btn.addEventListener("click", () => setBuilding(1));
if (module2Btn) module2Btn.addEventListener("click", () => setBuilding(2));
if (module3Btn) module3Btn.addEventListener("click", () => setBuilding(3));
if (module4Btn) module4Btn.addEventListener("click", () => setBuilding(4));
if (module5Btn) module5Btn.addEventListener("click", () => setBuilding(5));
if (module6Btn) module6Btn.addEventListener("click", () => setBuilding(6));
if (module7Btn) module7Btn.addEventListener("click", () => setBuilding(7));
if (module8Btn) module8Btn.addEventListener("click", () => setBuilding(8));

let problems_box: HTMLElement = document.getElementById("problems-box");
problems_box?.addEventListener("click", (ev) => {
    problems_box.classList.toggle("open");
});
