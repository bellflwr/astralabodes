// src/space-scene.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass";

const BLOOM_LAYER = 1;

export function createSpaceScene(container: HTMLElement) {
  const w = container.clientWidth;
  const h = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000007);

  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.set(0, 12, 36);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // --------- Space ambient lighting (subtle) ----------
  const ambient = new THREE.AmbientLight(0x223344, 0.25);
  scene.add(ambient);

  // --------- Emissive Sun (goes to bloom layer) ----------
  const sunGeo = new THREE.SphereGeometry(5, 48, 48);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffbb55 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(-18, 6, -30);
  sun.layers.set(BLOOM_LAYER);
  scene.add(sun);

  // A subtle rim light to accent geometry (not too bright)
  const rim = new THREE.DirectionalLight(0xffd2a6, 0.35);
  rim.position.set(-1, 0.5, -0.8).normalize();
  scene.add(rim);

  // --------- Starfield (procedural) ----------
  const starCount = 4000;
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = THREE.MathUtils.randFloat(200, 800);
    const theta = THREE.MathUtils.randFloatSpread(360) * (Math.PI / 180);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x9fb3ff, size: 0.8, sizeAttenuation: true });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --------- Example spaceship-ish kitbash (metal + emissive trims) ----------
  const group = new THREE.Group();
  scene.add(group);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(3.5, 10, 8, 16),
    new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.25, color: 0xb0b4c0 })
  );
  group.add(body);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(6, 0.35, 16, 64),
    new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.2, color: 0x9aa3b2 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.z = -2;
  group.add(ring);

  const engineGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 1.8, 24),
    new THREE.MeshBasicMaterial({ color: 0x66ccff })
  );
  engineGlow.rotation.x = Math.PI / 2;
  engineGlow.position.set(0, 0, -7.8);
  engineGlow.layers.set(BLOOM_LAYER);
  group.add(engineGlow);

  // Tiny emissive windows
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xa6f6ff });
  for (let i = 0; i < 20; i++) {
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), windowMat);
    const a = (i / 20) * Math.PI * 2;
    dot.position.set(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 2.2);
    dot.layers.set(BLOOM_LAYER);
    group.add(dot);
  }

  // Key light to model the ship a bit
  const key = new THREE.SpotLight(0x9ec9ff, 0.65, 100, Math.PI / 6, 0.4, 1);
  key.position.set(18, 14, 10);
  key.target = group;
  scene.add(key);
  scene.add(key.target);

  // --------- Post-processing pipeline ----------
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Color grade + vignette in one custom shader pass
  const ColorGradeVignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      exposure: { value: 1.05 },
      contrast: { value: 1.08 },
      saturation: { value: 0.95 },
      vignetteOffset: { value: 0.6 },
      vignetteDarkness: { value: 1.25 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float exposure;
      uniform float contrast;
      uniform float saturation;
      uniform float vignetteOffset;
      uniform float vignetteDarkness;
      varying vec2 vUv;

      vec3 ACESFilm(vec3 x){
        float a=2.51; float b=0.03; float c=2.43; float d=0.59; float e=0.14;
        return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
      }

      void main(){
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        col *= exposure;
        float luma = dot(col, vec3(0.2126,0.7152,0.0722));
        col = mix(vec3(luma), col, saturation);
        col = (col - 0.5) * contrast + 0.5;

        float dist = distance(vUv, vec2(0.5));
        float vig = smoothstep(vignetteOffset, 1.0, dist);
        col *= mix(1.0, 1.0 - vignetteDarkness * 0.45, vig);

        col = ACESFilm(col);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  };
  const colorGradeVignettePass = new ShaderPass(ColorGradeVignetteShader);
  composer.addPass(colorGradeVignettePass);

  // Bloom for emissive objects (sun, windows, engine)
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.25, 0.85);
  composer.addPass(bloomPass);

  // Film grain + subtle scanlines
  const filmPass = new FilmPass(0.35, 0.025, 648, false);
  composer.addPass(filmPass);

  // Render only bloom-layer contributions into bloom pass (optional advanced technique)
  // If you want strict selective bloom, uncomment the masked render logic:
  // renderer.autoClear = false;
  // function renderSelectiveBloom() {
  //   scene.traverse(obj => { if ((obj as any).material) {
  //     const m = (obj as any).material; m._origColorWrite ??= m.colorWrite;
  //     m.colorWrite = obj.layers.test(camera.layers) ? true : false;
  //   }});
  // }

  function onResize() {
    const W = container.clientWidth;
    const H = container.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    composer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    bloomPass.setSize(W, H);
  }
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    stars.rotation.y = t * 0.005;
    ring.rotation.z = t * 0.15;
    controls.update();
    composer.render();
    requestAnimationFrame(animate);
  }
  animate();

  return { scene, camera, renderer, composer, controls };
}
