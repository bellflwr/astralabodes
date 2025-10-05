import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { kinds, load_kinds } from "./module_kinds";
import { getBackNeighborForModule2, Modules, getNeighbors } from "./data/modules";
import { Object3D } from "three";
import { isPlacementAllowed, Module } from "./data/module";
import { Side, get_side_from_vector } from "./data/sides";
import { specMeta, SpecType } from "./data/specializations";
import { GLTFLoader, type GLTF } from "three/examples/jsm/Addons.js";
import { getModuleIndex } from "./data/module_kind";
import { setPreviewTint, tintModuleForTrash } from "./editor";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(24, 20, 32);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const hemi = new THREE.HemisphereLight(0xbdd2ff, 0x0a0a12, 0.25);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(-10, 12, 14);
dirLight.castShadow = false;
scene.add(dirLight);

new THREE.TextureLoader().load("./public/images/milky_way_skybox.jpg", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture;
  scene.environment = texture;
});

const modelLoader = new GLTFLoader();
let earth: Object3D | null = null;
let moon: Object3D | null = null;

modelLoader.load("models/Earth.glb", (gltf: GLTF) => {
  earth = gltf.scene;
  earth.position.set(-700, -650, 250);
  earth.scale.set(5, 5, 5);
  scene.add(earth);
});
modelLoader.load("models/Moon.glb", (gltf: GLTF) => {
  moon = gltf.scene;
  moon.position.set(600, -300, 700);
  moon.scale.set(2, 2, 2);
  scene.add(moon);
});

let mod_group: Object3D = new Object3D();
scene.add(mod_group);
let modules: Modules = new Modules(mod_group);
scene.add(modules.hitboxes);

let building = 0;
let previewModules: THREE.Object3D[] = [];
let trashMode = false;
let trashHoverTargets: Module[] = [];
let selectedModule: Module | null = null;
let rootModule: Module | null = null;

const moduleModal = document.getElementById("module-modal") as HTMLElement;
const specSelector = document.getElementById("spec-selector") as HTMLElement;
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
const trashBtn = document.getElementById("trash-btn") as HTMLButtonElement;
const costBox = document.getElementById("cost-box") as HTMLDivElement | null;
let problems_box: HTMLElement = document.getElementById("problems-box");
let problems_count: HTMLElement = document.getElementById("problems-count");
let problems_list: HTMLElement = document.getElementById("problems-list");

if (specSelector && document.querySelectorAll('input[name="spectype"]').length === 0) {
  for (const [k, v] of Object.entries(SpecType)) {
    let meta = specMeta.get(v);
    if (!meta) meta = { color: "#FF0000" };
    specSelector.innerHTML += `<label style="background-color: ${meta.color};">
      <input type="radio" name="spectype" id="${k}-radio" value="${v}" />
      <span>${k}</span>
    </label>`;
  }
}

function update_problem_list() {
  modules.calculate_specs();
  problems_list.innerHTML = "";
  
  let problemCount = 0;

  for(const [spec, meta] of specMeta.entries()) {
    const id = Object.keys(SpecType).find((k) => (SpecType as any)[k] == spec);

    if(modules.specs.get(spec) < meta.min_space) {
      problems_list.innerHTML += `
      <li style="border-left: 0.5em solid ${meta.color};">
      <b>${id}</b>: Minimum is ${meta.min_space}m&#179;, but you have ${modules.specs.get(spec)}m&#179;
      </li>
      `
      problemCount++;
    }
  }

  if (problemCount === 0) {
    problems_box.classList.add("no-problems");
  } else {
    problems_box.classList.remove("no-problems");
  }

  problems_count.innerHTML = problemCount.toFixed(0);
}

for (let rb of document.querySelectorAll('input[name="spectype"]')) {
  rb.addEventListener("change", (e: any) => {
    if (e.target?.checked && selectedModule)
    {
      selectedModule.spec = parseInt(e.target.value);
      update_problem_list();
    }
  });
}
const openModuleModal = (mod: Module) => {
  selectedModule = mod;
  const radios = document.querySelectorAll('input[name="spectype"]') as NodeListOf<HTMLInputElement>;
  radios.forEach((r) => (r.checked = false));
  if (selectedModule) {
    const id = Object.keys(SpecType).find((k) => (SpecType as any)[k] == selectedModule!.spec);
    if (id) {
      const el = document.getElementById(`${id}-radio`) as HTMLInputElement;
      if (el) el.checked = true;
    }
  }
  moduleModal?.classList.remove("modal-hidden");
};
moduleModal?.addEventListener("click", (e) => {
  if (e.target === moduleModal) moduleModal.classList.add("modal-hidden");
});
if (crewModal) crewModal.classList.add("modal-hidden");
if (evaluateBtn && crewModal) {
  evaluateBtn.addEventListener("click", () => crewModal.classList.remove("modal-hidden"));
  crewBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const size = (e.target as HTMLButtonElement).dataset.size;
      console.log("Selected crew size:", size);
      crewModal.classList.add("modal-hidden");
    });
  });
  crewModal.addEventListener("click", (e) => {
    if (e.target === crewModal) crewModal.classList.add("modal-hidden");
  });
}
problems_box?.addEventListener("click", () => problems_box.classList.toggle("open"));

const worldPosOf = (obj: THREE.Object3D) => {
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  return p;
};
const localFaceNormal = (isect: THREE.Intersection) => isect.face!.normal.clone().round();
const normalToWorldDir = (obj: THREE.Object3D, nLocal: THREE.Vector3) => {
  const nm = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
  return nLocal.clone().applyMatrix3(nm).normalize().round();
};

const COST_PER = 50_000_000;
let totalCost = 50_000_000;
const fmtMoney = (n: number) => "$" + n.toLocaleString("en-US");
const updateCostUI = () => {
  if (costBox) costBox.textContent = `Total Cost: ${fmtMoney(totalCost)}`;
};

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

load_kinds(() => {
  const m = new Module(kinds.get("Module 1"));
  m.position = new THREE.Vector3(0, 0, 0);
  modules.add_module(m);
  m.primary_dir = Side.FRONT;
  m.secondary_dir = Side.LEFT;
  rootModule = m;
  updateCostUI();
  update_problem_list();
});

const computeRemovalSet = (modulesInst: Modules, target: Module): Set<Module> => {
  const set = new Set<Module>();
  set.add(target);
  if (getModuleIndex(target) === 2) {
    const buddy = getBackNeighborForModule2(modulesInst, target);
    if (buddy) set.add(buddy);
  }
  return set;
};
const willRemainingCountBeValid = (modulesInst: Modules, target: Module): boolean => {
  const removal = computeRemovalSet(modulesInst, target);
  const remaining = modulesInst.modules.length - removal.size;
  return remaining >= 1;
};
const canTrash = (modulesInst: Modules, mod: Module): boolean => {
  const neighbors = getNeighbors(modulesInst, mod);
  if (neighbors.length !== 1) return false;
  return willRemainingCountBeValid(modulesInst, mod);
};

function applyExtraPlacementRules(placingIndex: number, targetIdx: number, sideLocalOnTarget: Side): boolean {
  if ((placingIndex === 1 || placingIndex === 2) && (targetIdx >= 3 && targetIdx <= 7)) {
    if (targetIdx === 3 && sideLocalOnTarget === Side.FRONT) return true;
    return false;
  }
  if ((placingIndex >= 3 && placingIndex <= 7) && (targetIdx === 1 || targetIdx === 2)) return false;
  return true;
}

function chooseSecondaryFromWorld(dirWorld: THREE.Vector3): Side {
  const up = new THREE.Vector3(0, 1, 0);
  let ref = up.clone();
  if (Math.abs(dirWorld.dot(up)) > 0.999) ref.set(0, 0, 1);
  const right = new THREE.Vector3().crossVectors(dirWorld, ref).normalize();
  const correctedUp = new THREE.Vector3().crossVectors(right, dirWorld).normalize();
  return get_side_from_vector(correctedUp);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  scene.updateMatrixWorld(true);
  const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  if (trashMode) {
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
      }
    }
    trashMode = false;
    return;
  }

  if (!building) {
    const intersects = raycaster.intersectObject(modules.hitboxes, true);
    if (intersects.length > 0) {
      const hitObj: any = intersects[0].object;
      const mod = hitObj.module_data as Module;
      if (mod) openModuleModal(mod);
    }
    return;
  }

  const intersects = raycaster.intersectObject(modules.hitboxes, true);
  if (!(intersects.length && intersects[0].face)) return;

  const hitObj: any = intersects[0].object;
  const nLocalOnTarget = localFaceNormal(intersects[0]);
  const targetMod = hitObj.module_data as Module | undefined;
  const targetIdx = getModuleIndex(targetMod);
  const sideLocal = get_side_from_vector(nLocalOnTarget);
  let ok = isPlacementAllowed(targetMod, nLocalOnTarget, building);
  if (ok) ok = applyExtraPlacementRules(building, targetIdx, sideLocal);

  if (!ok) {
    showFlash("You cannot place that there", 1000);
    if (previewModules.length > 0) {
      previewModules.forEach((p) => scene.remove(p));
      previewModules = [];
    }
    building = 0;
    return;
  }

  if (previewModules.length > 0) {
    let placedCount = 0;
    previewModules.forEach((preObj) => {
      const kind = kinds.get("Module " + building);
      if (!kind) return;
      const placedModule = new Module(kind);
      placedModule.position = preObj.position.clone();
      placedModule.object.position.copy(preObj.position);
      placedModule.object.rotation.copy(preObj.rotation);
      placedModule.object.scale.copy(preObj.scale);
      if ((preObj as any).userData?.primary_dir) placedModule.primary_dir = (preObj as any).userData.primary_dir;
      if ((preObj as any).userData?.secondary_dir) placedModule.secondary_dir = (preObj as any).userData.secondary_dir;
      modules.add_module(placedModule);
      placedCount += 1;
    });
    totalCost += placedCount * COST_PER;
    updateCostUI();
    previewModules.forEach((p) => scene.remove(p));
    previewModules = [];
    building = 0;
  }
});

renderer.domElement.addEventListener("mousemove", (event) => {
  scene.updateMatrixWorld(true);
  const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  if (trashMode) {
    for (const m of trashHoverTargets) tintModuleForTrash(m, false);
    trashHoverTargets = [];
    const hit = raycaster.intersectObject(modules.hitboxes, true);
    if (hit.length && hit[0].object) {
      const target: any = hit[0].object;
      const mod = target.module_data as Module;
      if (mod) {
        const ok = canTrash(modules, mod);
        if (ok) {
          tintModuleForTrash(mod, true);
          trashHoverTargets.push(mod);
          if (getModuleIndex(mod) === 2) {
            const buddy = getBackNeighborForModule2(modules, mod);
            if (buddy) {
              tintModuleForTrash(buddy, true);
              trashHoverTargets.push(buddy);
            }
          }
        }
      }
    }
    if (previewModules.length > 0) {
      previewModules.forEach((o) => scene.remove(o));
      previewModules = [];
    }
    return;
  }

  if (previewModules.length > 0) {
    previewModules.forEach((o) => scene.remove(o));
    previewModules = [];
  }
  if (!building) return;

  const intersects = raycaster.intersectObject(modules.hitboxes, true);
  if (!(intersects.length && intersects[0].face)) return;

  const hitObj: any = intersects[0].object;
  const nLocalOnTarget = localFaceNormal(intersects[0]);
  const dirWorld = normalToWorldDir(hitObj, nLocalOnTarget);
  const hitPosWorld = worldPosOf(hitObj);
  const pos = hitPosWorld.clone().add(dirWorld.clone().multiplyScalar(12));

  const kind = kinds.get(`Module ${building}`);
  if (!kind) return;

  const preview = new Module(kind);
  preview.position = pos.clone();

  const primary = get_side_from_vector(dirWorld.clone().multiplyScalar(-1));
  const secondary = chooseSecondaryFromWorld(dirWorld);
  preview.primary_dir = primary;
  preview.secondary_dir = secondary;

  (preview.object as any).userData = (preview.object as any).userData || {};
  (preview.object as any).userData.primary_dir = preview.primary_dir;
  (preview.object as any).userData.secondary_dir = preview.secondary_dir;

  const targetMod = hitObj.module_data as Module | undefined;
  const targetIdx = getModuleIndex(targetMod);
  const sideLocal = get_side_from_vector(nLocalOnTarget);
  let ok = isPlacementAllowed(targetMod, nLocalOnTarget, building);
  if (ok) ok = applyExtraPlacementRules(building, targetIdx, sideLocal);

  const shouldInvert = building === 8 && targetIdx >= 3 && targetIdx <= 7;
  if (shouldInvert) preview.object.scale.x *= -1;

  setPreviewTint(preview.object, ok);
  scene.add(preview.object);
  previewModules.push(preview.object);

  if (building === 2) {
    const invertedPreview = new Module(kind);
    invertedPreview.position = pos.clone().add(dirWorld.clone().multiplyScalar(12));
    invertedPreview.primary_dir = preview.primary_dir;
    invertedPreview.secondary_dir = preview.secondary_dir;
    invertedPreview.object.scale.x *= -1;
    (invertedPreview.object as any).userData = (invertedPreview.object as any).userData || {};
    (invertedPreview.object as any).userData.primary_dir = invertedPreview.primary_dir;
    (invertedPreview.object as any).userData.secondary_dir = invertedPreview.secondary_dir;
    setPreviewTint(invertedPreview.object, ok);
    scene.add(invertedPreview.object);
    previewModules.push(invertedPreview.object);
  }
});

if (trashBtn) {
  trashBtn.addEventListener("click", () => {
    if (trashMode) {
      for (const m of trashHoverTargets) tintModuleForTrash(m, false);
      trashHoverTargets = [];
    }
    trashMode = !trashMode;
  });
}

const setBuilding = (n: number) => {
  building = n;
  if (previewModules.length > 0) {
    previewModules.forEach((o) => scene.remove(o));
    previewModules = [];
  }
};
module1Btn?.addEventListener("click", () => setBuilding(1));
module2Btn?.addEventListener("click", () => setBuilding(2));
module3Btn?.addEventListener("click", () => setBuilding(3));
module4Btn?.addEventListener("click", () => setBuilding(4));
module5Btn?.addEventListener("click", () => setBuilding(5));
module6Btn?.addEventListener("click", () => setBuilding(6));
module7Btn?.addEventListener("click", () => setBuilding(7));
module8Btn?.addEventListener("click", () => setBuilding(8));

function animate() {
  controls.update();
  renderer.render(scene, camera);
}
