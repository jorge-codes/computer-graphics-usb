// Solar system, FixedFunction (FF) version.
import './style.css';
import { mat3, mat4 } from 'gl-matrix';
import type { ReadonlyMat4 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING } from './vendor/ff/ff';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CLEAR_COLOR,
  CUBE_INDICES,
  CUBE_VERTICES,
  EARTH_COLOR,
  EARTH_ORBIT_RADIUS,
  EARTH_SIZE,
  MOON_COLOR,
  MOON_ORBIT_RADIUS,
  MOON_SIZE,
  NORMAL_OFFSET_BYTES,
  ORBIT_COLOR,
  ORBIT_SEGMENTS,
  STRIDE_BYTES,
  SUN_COLOR,
  SUN_SIZE,
} from './constants';

type FF = ReturnType<typeof createFixedFunction>;

const SUN_SPIN_SPEED = 0.2; // rad/s
const EARTH_ORBIT_SPEED = 0.3; // rad/s
const EARTH_SPIN_SPEED = 2.0; // rad/s
const MOON_ORBIT_SPEED = 1.6; // rad/s
const MAX_DT = 0.1; // seconds

// Step 1. Get the WebGL2 context.
function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is not available.');
  return gl;
}

// Step 2. Shaders and program are created by FF.
// Step 3. Copy vertex and index data to the GPU.
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

// Vertices of a circle in the XZ plane (y = 0), as x, y, z per vertex.
function createOrbitVertices(radius: number): Float32Array {
  const data = new Float32Array(ORBIT_SEGMENTS * 3);
  for (let i = 0; i < ORBIT_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / ORBIT_SEGMENTS;
    data[i * 3] = radius * Math.cos(angle);
    data[i * 3 + 1] = 0;
    data[i * 3 + 2] = radius * Math.sin(angle);
  }
  return data;
}

// Step 4. Describe how the vertex data is laid out, using FF's attribute slots.
function createVAO(gl: WebGL2RenderingContext, vertices: WebGLBuffer, indices: WebGLBuffer): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bindVertexArray(null);
  return vao;
}

// Orbit lines use position only.
function createOrbitVAO(gl: WebGL2RenderingContext, radius: number): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  createVertexBuffer(gl, createOrbitVertices(radius));
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, 3 * 4, 0);
  gl.bindVertexArray(null);
  return vao;
}

// Step 5. Pipeline state: canvas size, viewport, clear color, depth test, face culling.
function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
}

// Step 6. Scene: lighting, one directional light, camera.
function setupScene(ff: FF): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([0.3, 0.3, 0.3, 1]);

  ff.setLight(0, { position: [1, 1, 0.5, 0], diffuse: [1, 1, 1, 1] });
  ff.enableLight(0);

  const view = mat4.lookAt(mat4.create(), [0, 4, 8.5], [0, -0.4, 0], [0, 1, 0]);
  ff.setViewMatrix(view);
  ff.setProjectionMatrix(mat4.perspective(mat4.create(), Math.PI / 4, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 100));
}

// ---------------------------------------------------------------------------
// Game loop. Every frame does three separate phases:
//   1. processInput: read what the user did.
//   2. update(dt): advance the simulation by the elapsed time dt.
//   3. render: draw the current state.
// Keep the phases apart: render never changes the state, and update never calls WebGL.
// ---------------------------------------------------------------------------

// Game state: angles and the pause flag, nothing about WebGL.
const state = { sunSpin: 0, earthOrbit: 0, earthSpin: 0, moonOrbit: 0, rotating: true };

// Input: the keydown listener only records presses. processInput handles them later, once per frame.
let rPressed = false;

function setupInput(): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyR') rPressed = true;
  });
}

// Loop phase 1. R toggles the rotation.
function processInput(): void {
  if (rPressed) state.rotating = !state.rotating;
  rPressed = false;
}

// Loop phase 2.
function update(dt: number): void {
  if (!state.rotating) return; // paused: the angles keep their values
  state.sunSpin += SUN_SPIN_SPEED * dt;
  state.earthOrbit += EARTH_ORBIT_SPEED * dt;
  state.earthSpin += EARTH_SPIN_SPEED * dt;
  state.moonOrbit += MOON_ORBIT_SPEED * dt;
}

// Loop phase 3. Draw the current state. render reads the state and never changes it.
// All bodies share one model matrix: each body overwrites it before its draw.
const sunFrame = mat4.create();
const earthFrame = mat4.create();
const moonFrame = mat4.create();
const model = mat4.create();
const normalMatrix = mat3.create();

// Draws one cube with the given model matrix. FF needs the normal matrix for lighting.
function drawCube(
  gl: WebGL2RenderingContext,
  ff: FF,
  vao: WebGLVertexArrayObject,
  color: readonly [number, number, number],
  modelMatrix: ReadonlyMat4,
): void {
  ff.setMaterial({ ambient: color, diffuse: color });
  ff.setModelMatrix(modelMatrix);
  ff.setNormalMatrix(mat3.normalFromMat4(normalMatrix, modelMatrix));
  gl.bindVertexArray(vao);
  ff.drawElements(gl.TRIANGLES, CUBE_INDICES.length, gl.UNSIGNED_SHORT, 0);
}

// Draws one orbit line. The line is unlit, so it has no normal matrix.
function drawOrbit(gl: WebGL2RenderingContext, ff: FF, vao: WebGLVertexArrayObject, frame: ReadonlyMat4): void {
  ff.disable(LIGHTING);
  ff.setColor(ORBIT_COLOR);
  ff.setModelMatrix(frame);
  gl.bindVertexArray(vao);
  ff.drawArrays(gl.LINE_LOOP, 0, ORBIT_SEGMENTS);
  ff.enable(LIGHTING);
}

function render(
  gl: WebGL2RenderingContext,
  ff: FF,
  cubeVao: WebGLVertexArrayObject,
  earthOrbitVao: WebGLVertexArrayObject,
  moonOrbitVao: WebGLVertexArrayObject,
): void {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Frames. A frame is parent frame * orbit rotation * translation.
  // gl-matrix multiplies on the right: rotateY(out, a, r) computes a * Ry(r).
  // The code reads parent to child. The last call applies first to the vertices.
  mat4.identity(sunFrame); // the Sun has no parent and no orbit

  mat4.copy(earthFrame, sunFrame);
  mat4.rotateY(earthFrame, earthFrame, state.earthOrbit);
  mat4.translate(earthFrame, earthFrame, [EARTH_ORBIT_RADIUS, 0, 0]);

  mat4.copy(moonFrame, earthFrame);
  mat4.rotateY(moonFrame, moonFrame, state.moonOrbit);
  mat4.translate(moonFrame, moonFrame, [MOON_ORBIT_RADIUS, 0, 0]);

  // Orbit lines. Each line uses the frame of the body it orbits.
  drawOrbit(gl, ff, earthOrbitVao, sunFrame);
  drawOrbit(gl, ff, moonOrbitVao, earthFrame);

  // Bodies. A model is frame * own spin * own scale. Only the model draws the body.
  // The Sun's spin is in the Sun's model only, so it does not reach the Earth.
  mat4.copy(model, sunFrame);
  mat4.rotateY(model, model, state.sunSpin);
  mat4.scale(model, model, [SUN_SIZE, SUN_SIZE, SUN_SIZE]);
  drawCube(gl, ff, cubeVao, SUN_COLOR, model);

  mat4.copy(model, earthFrame);
  mat4.rotateY(model, model, state.earthSpin);
  mat4.scale(model, model, [EARTH_SIZE, EARTH_SIZE, EARTH_SIZE]);
  drawCube(gl, ff, cubeVao, EARTH_COLOR, model);

  mat4.copy(model, moonFrame);
  mat4.scale(model, model, [MOON_SIZE, MOON_SIZE, MOON_SIZE]);
  drawCube(gl, ff, cubeVao, MOON_COLOR, model);
}

function run(canvas: HTMLCanvasElement): void {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: true });
  const cubeVertices = createVertexBuffer(gl, CUBE_VERTICES);
  const cubeIndices = createIndexBuffer(gl, CUBE_INDICES);
  const cubeVao = createVAO(gl, cubeVertices, cubeIndices);
  const earthOrbitVao = createOrbitVAO(gl, EARTH_ORBIT_RADIUS);
  const moonOrbitVao = createOrbitVAO(gl, MOON_ORBIT_RADIUS);
  setupState(gl, canvas);
  setupScene(ff);
  setupInput();

  let last: number | null = null;
  function frame(now: number): void {
    if (last === null) last = now;
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    processInput();
    update(dt);
    render(gl, ff, cubeVao, earthOrbitVao, moonOrbitVao);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Page scaffolding.
const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas);
