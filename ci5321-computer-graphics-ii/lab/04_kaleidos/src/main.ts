import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

// "Old" and simple way of importing shaders with Vite GLSL plugin
// import vertexShader from './shaders/vertex.glsl';
// import fragmentShader from './shaders/fragment.glsl';

// "New" way of importing shaders with Vite GLSL plugin
import commonGLSL from './shaders/common.glsl?raw';
import vertexGLSL from './shaders/vertex.glsl?raw';
import fragmentGLSL from './shaders/frag_experiment.glsl?raw';
// import fragmentGLSL from './shaders/frag_exp_final.glsl?raw';
const combinedVertexGLSL = commonGLSL + vertexGLSL;
const combinedFragmentGLSL = commonGLSL + fragmentGLSL;

class App {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private startTime: number;

  private camConfig = {
    fov: 75,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 1000,
  };

  constructor() {
    // Create scene
    this.scene = new THREE.Scene();

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      this.camConfig.fov,
      this.camConfig.aspect,
      this.camConfig.near,
      this.camConfig.far
    );

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!this.renderer.capabilities.isWebGL2) {
      console.warn('WebGL 2.0 is not available on this browser.');
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const canvas = document.body.appendChild(this.renderer.domElement);

    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

    // Create shader material
    this.geometry = new THREE.PlaneGeometry(1, 1, 64, 64);

    const count = this.geometry.attributes.position.count;
    let randoms = new Float32Array(count);
    randoms = randoms.map(() => Math.random());
    const randomAttributes = new THREE.BufferAttribute(randoms, 1);
    this.geometry.setAttribute('a_random', randomAttributes);

    const textureLoader = new THREE.TextureLoader();
    const flagTexture = textureLoader.load('static/img/flag-usb.jpg');

    this.material = new THREE.RawShaderMaterial({
      vertexShader: combinedVertexGLSL,
      fragmentShader: combinedFragmentGLSL,
      transparent: true,
      uniforms: {
        projectionMatrix: { value: this.camera.projectionMatrix },
        viewMatrix: { value: this.camera.matrixWorldInverse },
        modelMatrix: { value: new THREE.Matrix4() },
        // custom uniforms
        uTime: { value: 0.0 },
        uResolution: { value: resolution },
        uColor: { value: new THREE.Vector4(-1, -1, -1, -1) },
        uTexture: { value: flagTexture },
      },
      glslVersion: THREE.GLSL3,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
    this.camera.position.z = 0.56;

    const controls = new OrbitControls(this.camera, canvas);
    controls.enableDamping = true;

    // Initialize
    this.startTime = Date.now();
    this.onWindowResize();

    // Bind methods
    this.onWindowResize = this.onWindowResize.bind(this);
    this.animate = this.animate.bind(this);

    // Add event listeners
    window.addEventListener('resize', this.onWindowResize);

    // Start the main loop
    this.animate();
  }

  private animate(): void {
    requestAnimationFrame(this.animate);
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    this.material.uniforms.uTime.value = elapsedTime;
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    this.camera.aspect = this.camConfig.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
}

const myApp = new App();
