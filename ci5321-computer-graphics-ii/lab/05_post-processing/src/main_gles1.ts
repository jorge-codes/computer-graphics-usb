import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
// Post-processing imports
// You can read more about the post-processing effects here:
// https://threejs.org/docs/#examples/en/postprocessing/EffectComposer
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// plain vertex shader
import vertexShader from './shaders/vertex.glsl';
// plain fragment shader that shows the loaded texture
import fragmentShader from './shaders/texture.glsl';

// Post-processing shaders
import ppVertexShader from './shaders/pp_vertex.glsl';
import ppFragmentGrayScale from './shaders/pp_frag_grayscale.glsl';
const grayscaleShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 1.0 },
  },
  vertexShader: ppVertexShader,
  fragmentShader: `
    precision highp float;
    
    uniform sampler2D tDiffuse;
    uniform float intensity;
    
    in vec2 vUv;
    // out vec4 fragColor;
    
    void main() {
      vec4 color = texture(tDiffuse, vUv);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 grayscale = vec3(gray);
      color.rgb = mix(color.rgb, grayscale, intensity);
      gl_FragColor = color;
      // fragColor = color;
    }
  `,
};

/**
 * PostProcessing effect interface
 */
interface Effect {
  pass: ShaderPass;
  name: string;
  enabled: boolean;
  params?: Record<string, any>;
}

class App {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private geometry: any;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private startTime: number;

  // Post-processing
  private composer: EffectComposer;
  private effects: Map<string, Effect>;

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

    this.geometry = new THREE.BoxGeometry(1, 1, 1, 32, 32, 32);

    const count = this.geometry.attributes.position.count;
    let randoms = new Float32Array(count);
    randoms = randoms.map(() => Math.random());
    const randomAttributes = new THREE.BufferAttribute(randoms, 1);
    this.geometry.setAttribute('a_random', randomAttributes);

    const textureLoader = new THREE.TextureLoader();
    const boxTexture = textureLoader.load('static/img/box.jpeg');

    this.material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        projectionMatrix: { value: this.camera.projectionMatrix },
        viewMatrix: { value: this.camera.matrixWorldInverse },
        modelMatrix: { value: new THREE.Matrix4() },
        // custom uniforms
        uTime: { value: 0.0 },
        uResolution: { value: resolution },
        uTexture: { value: boxTexture },
      },
      glslVersion: THREE.GLSL3,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
    this.camera.position.z = 1.5;

    const controls = new OrbitControls(this.camera, canvas);
    controls.enableDamping = true;

    // Initialize post-processing
    this.setupPostProcessing();

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

  /**
   * Sets up the post-processing pipeline
   */
  private setupPostProcessing(): void {
    // Initialize the effect composer
    this.composer = new EffectComposer(this.renderer);

    // Add the render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Initialize effects collection
    this.effects = new Map<string, Effect>();

    // Add grayscale effect
    this.addEffect('grayscale', grayscaleShader);
  }

  private createGLSL3ShaderPass(shaderDefinition: any): ShaderPass {
    // Create a custom material that explicitly uses GLSL 3.0
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(shaderDefinition.uniforms),
      vertexShader: shaderDefinition.vertexShader,
      fragmentShader: shaderDefinition.fragmentShader,
      glslVersion: THREE.GLSL3,
    });

    // Create a ShaderPass with this material
    const pass = new ShaderPass(material);

    return pass;
  }

  public addEffect(name: string, shaderDefinition: any, params?: Record<string, any>): void {
    // GLSL 1.0 regular stuff
    const pass = new ShaderPass(shaderDefinition);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (pass.uniforms[key] !== undefined) {
          pass.uniforms[key].value = value;
        }
      });
    }

    // Add the pass to the composer
    this.composer.addPass(pass);

    // Store the effect for later manipulation
    this.effects.set(name, {
      pass,
      name,
      enabled: true,
      params,
    });
  }

  public toggleEffect(name: string, enabled: boolean): void {
    const effect = this.effects.get(name);
    if (effect) {
      effect.pass.enabled = enabled;
      effect.enabled = enabled;
    }
  }

  public updateEffectParam(name: string, paramName: string, value: any): void {
    const effect = this.effects.get(name);
    if (effect && effect.pass.uniforms[paramName] !== undefined) {
      effect.pass.uniforms[paramName].value = value;
      if (effect.params) {
        effect.params[paramName] = value;
      }
    }
  }

  private animate(): void {
    requestAnimationFrame(this.animate);
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    this.material.uniforms.uTime.value = elapsedTime;

    // Forget about the renderer, we will use the composer instead
    // this.renderer.render(this.scene, this.camera);
    // Use the composer instead of directly rendering
    this.composer.render();
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    // Update the renderer when resizing, this is necessary
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Update the composer when resizing
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}

const myApp = new App();

// Example of how to control the effect after initialization:
// myApp.updateEffectParam('grayscale', 'intensity', 0.5); // 50% grayscale
// myApp.toggleEffect('grayscale', false); // Turn off grayscale
