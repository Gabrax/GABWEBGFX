import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { Home } from "/pages/home/home.ts";
import { ModelViewer } from "/pages/model_viewer/model_viewer.ts";
import { MusicVisualizerPlayer } from "/pages/music_visualizer/music_visualizer.ts";
import { Tetris } from "/pages/tetris/tetrisGame.ts";

let currentPage: any = null;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const loader = new THREE.CubeTextureLoader();
const cubeTexture = loader.load([
  '/Home/NightSky_Right.png',
  '/Home/NightSky_Left.png',
  '/Home/NightSky_Top.png',
  '/Home/NightSky_Bottom.png',
  '/Home/NightSky_Front.png',
  '/Home/NightSky_Back.png',
]);

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    envMap: { value: cubeTexture },
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform samplerCube envMap;
    uniform float uTime;
    varying vec3 vWorldPosition;

    vec3 rotateY(vec3 v, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return vec3(
        c*v.x + s*v.z,
        v.y,
        -s*v.x + c*v.z
      );
    }

    void main() {
      vec3 dir = normalize(vWorldPosition - cameraPosition);
      dir = rotateY(dir, uTime);
      gl_FragColor = texture(envMap, dir);
    }
  `,
  side: THREE.BackSide
});
const skySphere = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 64), skyMat);
scene.add(skySphere);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

renderer.autoClear = false;

function animate(time: number)
{
  requestAnimationFrame(animate);

  skyMat.uniforms.uTime.value += 0.0001;

  renderer.clear();

  renderer.render(scene, camera);

  currentPage?.update?.(time);
}

requestAnimationFrame(animate);

const pages = {
  home: `/pages/home/home.html`,
  viewer: `/pages/model_viewer/model_viewer.html`,
  visualizer: `/pages/music_visualizer/music_visualizer.html`,
  tetris: `/pages/tetris/tetrisGame.html`
};

const content = document.getElementById("content");
const links = document.querySelectorAll("[data-page]");

async function loadPage(name: string)
{
  if (currentPage && typeof currentPage.destroy === "function") {
    currentPage.destroy();
  }

  content.classList.remove("visible");

  links.forEach(l => l.classList.remove("active"));
  document.querySelector(`[data-page="${name}"]`)?.classList.add("active");

  setTimeout(async () => {
    const url = pages[name];
    if (!url) return;

    try {
      const res = await fetch(url);
      const html = await res.text();
      content.innerHTML = html;
      content.classList.add("visible");

      if (name === "home") currentPage = new Home(renderer, camera);
      else if (name === "viewer") currentPage = new ModelViewer(renderer);
      else if (name === "visualizer") currentPage = new MusicVisualizerPlayer(renderer);
      else if (name === "tetris") currentPage = new Tetris(renderer, 10, 20);
      else currentPage = null;

    } catch (err) {
      console.log(err);
      content.innerHTML = "<p>Error loading page</p>";
    }
  }, 300);
}

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

links.forEach(link => {
  link.addEventListener("click", () => loadPage(link.dataset.page!));
});

loadPage("home");
