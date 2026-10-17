// Rotating cube, FixedFunction (FF) version.
import './style.css';
import { mat3, mat4 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING } from './vendor/ff/ff';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CLEAR_COLOR,
  COLORS,
  CUBE_INDICES,
  CUBE_VERTICES,
  NORMAL_OFFSET_BYTES,
  STRIDE_BYTES,
} from './constants';

type FF = ReturnType<typeof createFixedFunction>;

const ROTATION_SPEED = 0.8; 
const MAX_DT = 0.1; // seconds

// Step 1. Get the WebGL2 context.
function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is not available.');
  return gl;
}

// Step 2. Shaders and program: FF creates and owns them.
// Step 3. Vertex specification: copy the vertex and index data to the GPU.
function createVertexBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function createIndexBuffer(gl: WebGL2RenderingContext, data: Uint16Array): WebGLBuffer {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

// Step 4. Describe how the vertex data is laid out, using FF's attribute slots.
// No ATTRIB.COLOR: lit colors come from the material.
function createVAO(gl: WebGL2RenderingContext, vertices: WebGLBuffer, indices: WebGLBuffer): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);
  // The VAO remembers the ELEMENT_ARRAY_BUFFER bound while it is bound.
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bindVertexArray(null);
  return vao;
}

// Step 5. Pipeline state: canvas size, viewport, clear color, depth test, face culling.
function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST); // new vs. the triangle: nearer faces must hide farther ones
  gl.enable(gl.CULL_FACE); // skip back faces; front faces are counter-clockwise (the default)
}

// Step 6. Scene: lighting, one directional light, camera.
function setupScene(ff: FF): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([0.2, 0.2, 0.2, 1]); // the FF default, set explicitly to make it visible

  // The light TRAVELS in direction (-1, -1, -0.5): down, left, slightly away from the camera.
  // FF's position (w = 0) points TOWARD the light, so the sign flips: (1, 1, 0.5, 0).
  // Passing the travel direction instead lights the faces that point away from the light.
  ff.setLight(0, { position: [1, 1, 0.5, 0], diffuse: [1, 1, 1, 1] });
  ff.enableLight(0);

  const view = mat4.lookAt(mat4.create(), [0, 1.5, 4], [0, 0, 0], [0, 1, 0]);
  ff.setViewMatrix(view);
  // Aspect = width / height of the drawing buffer (4:3). A wrong aspect stretches the cube.
  const projection = mat4.perspective(mat4.create(), Math.PI / 4, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 100);
  ff.setProjectionMatrix(projection);
}

// ---------------------------------------------------------------------------
// Game loop. Every frame does three separate phases:
//   1. processInput: read what the user did.
//   2. update(dt): advance the simulation by the elapsed time dt.
//   3. render: draw the current state.
// Keep the phases apart: render never changes the state, and update never calls WebGL.
// ---------------------------------------------------------------------------

// Game state: everything the simulation needs, nothing about WebGL.
const state = { angle: 0, colorIndex: 0, rotating: true };

// Input: the keydown listener only records presses. processInput handles them later, once per frame.
let spacePressed = false;
let rPressed = false;

function setupInput(): void {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault(); // stops the page from scrolling
    if (e.repeat) return; // holding a key counts as one press
    if (e.code === 'Space') spacePressed = true;
    if (e.code === 'KeyR') rPressed = true;
  });
  // Research: key-state polling with edge detection. Store which keys are down, and compare with
  // the last frame: pressed = down now && !down last frame. When does it fit better than events?
}

// Loop phase 1. Space selects the next color. R toggles the rotation.
// Each flag is cleared after use, so each press counts once.
//
function processInput(): void {
  if (spacePressed) state.colorIndex = (state.colorIndex + 1) % COLORS.length;
  if (rPressed) state.rotating = !state.rotating;
  spacePressed = false;
  rPressed = false;
}

// Loop phase 2. 
function update(dt: number): void {
  if (state.rotating) state.angle += ROTATION_SPEED * dt; // paused: the angle keeps its value
}

// Loop phase 3. Draw the current state. render reads the state and never changes it.
// setMaterial runs every frame, so FF re-uploads the material each frame. That costs a few
// uniforms and keeps render simple. Exercise: set the material only when colorIndex changes.
const model = mat4.create();
const normalMatrix = mat3.create();

function render(gl: WebGL2RenderingContext, ff: FF, vao: WebGLVertexArrayObject): void {
  const color = COLORS[state.colorIndex];
  ff.setMaterial({ ambient: color, diffuse: color }); // specular stays at the FF default (0)

  mat4.fromYRotation(model, state.angle);
  ff.setModelMatrix(model);
  // FF needs the normal matrix for lit normals: setModelMatrix does not update it.
  ff.setNormalMatrix(mat3.normalFromMat4(normalMatrix, model));

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.bindVertexArray(vao);
  ff.drawElements(gl.TRIANGLES, CUBE_INDICES.length, gl.UNSIGNED_SHORT, 0);
}

function run(canvas: HTMLCanvasElement): void {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: true });
  const vertices = createVertexBuffer(gl, CUBE_VERTICES);
  const indices = createIndexBuffer(gl, CUBE_INDICES);
  const vao = createVAO(gl, vertices, indices);
  setupState(gl, canvas);
  setupScene(ff);
  setupInput();

  state.colorIndex = 2;
  let last: number | null = null; // set by the first frame, so dt starts at 0
  function frame(now: number): void {
    if (last === null) last = now;
    // rAF pauses in hidden tabs. On return, (now - last) would be huge, so cap dt.
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    processInput();
    update(dt);
    render(gl, ff, vao);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Page scaffolding: create the canvas and start the cube.
const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas);
