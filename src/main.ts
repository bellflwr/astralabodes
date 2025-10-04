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
scene.add(cube);
// cube.position.x = 2;

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

load_kinds(() => {
    let m = new Module(kinds[0]);
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
    const intersects = raycaster.intersectObject(cube);
    if (intersects.length > 0) {
        transitionTarget.copy(cube.position);
        transitioning = true;
    }
});
camera.position.z = 5;

function init() {
    skyboxGeo = new THREE.BoxGeometry(10000, 10000, 10000);
}

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

    // UI Interactivity for Evaluate button and Crew Modal
const evaluateBtn = document.getElementById("evaluate-btn") as HTMLButtonElement;
const crewModal = document.getElementById("crew-modal") as HTMLDivElement;
const crewBtns = document.querySelectorAll(".crew-btn");

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
