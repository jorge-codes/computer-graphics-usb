import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1e2b);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// --- Cube Geometry with Colors ---
const geometry = new THREE.BoxGeometry(1, 1, 1);

// Define colors for each face
const faceColors = [
  new THREE.Color(1, 0, 0), // right - red
  new THREE.Color(0, 1, 0), // left - green
  new THREE.Color(0, 0, 1), // top - blue
  new THREE.Color(1, 1, 0), // bottom - yellow
  new THREE.Color(1, 0, 1), // front - magenta
  new THREE.Color(0, 1, 1)  // back - cyan
];

const colors = [];
const position = geometry.attributes.position;
for (let i = 0; i < position.count; i++) {
  // Each side has 6 vertices → find which face we’re in
  const faceIndex = Math.floor(i / 6);
  const color = faceColors[faceIndex];
  colors.push(color.r, color.g, color.b);
}

geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));

// Use a lighting-reactive material
const material = new THREE.MeshLambertMaterial({ vertexColors: true });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// --- Add Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft global light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(3, 3, 5);
scene.add(directionalLight);

// --- Rotation control ---
window.addEventListener("keydown", (event) => {
  const step = 0.1;
  switch (event.key) {
    case "ArrowUp":
      cube.rotation.x -= step;
      break;
    case "ArrowDown":
      cube.rotation.x += step;
      break;
    case "ArrowLeft":
      cube.rotation.y -= step;
      break;
    case "ArrowRight":
      cube.rotation.y += step;
      break;
  }
});

function animate() {
  renderer.render(scene, camera);
}
