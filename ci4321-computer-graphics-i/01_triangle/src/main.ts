import * as THREE from "three";

const app = document.querySelector("#app");
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(mainLoop);
app?.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camConfig = {
  fov: 75,
  ratio: window.innerWidth / window.innerHeight,
  near: 0.1,
  far: 1000,
};
const camera = new THREE.PerspectiveCamera(
  camConfig.fov,
  camConfig.ratio,
  camConfig.near,
  camConfig.far,
);

camera.position.z = 5;

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x11ff44 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

function mainLoop(): void {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render(scene, camera);
}
