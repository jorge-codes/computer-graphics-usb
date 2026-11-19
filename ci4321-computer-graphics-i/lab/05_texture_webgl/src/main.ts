// Textured rotating cube and two static quads (one with a transparent texture), FixedFunction (FF) version.
import './style.css';
import { mat3, mat4 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING, TEXTURE_2D, TEXTURE_UNIT } from './vendor/ff/ff';
import type { FixedFunction } from './vendor/ff/ff';
import woodUrl from './textures/Wood_07-512x512.png';
import camoUrl from './textures/camo.png';
import bushUrl from './textures/bush.png';
import {
  BUSH_ASPECT,
  BUSH_X,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CLEAR_COLOR,
  CUBE_INDICES,
  CUBE_VERTICES,
  CUBE_X,
  NORMAL_OFFSET_BYTES,
  QUAD_COLORS,
  QUAD_INDICES,
  QUAD_VERTICES,
  QUAD_X,
  STRIDE_BYTES,
  UV_OFFSET_BYTES,
} from './constants';

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
// Each vertex is now x, y, z, nx, ny, nz, s, t. The pair (s, t) is new: the texture coordinate (also called UV).
// It is defined per vertex in constants.ts.
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
// No ATTRIB.COLOR: lit colors come from the material. ATTRIB.UV carries the texture coordinates (s, t).
function createVAO(gl: WebGL2RenderingContext, vertices: WebGLBuffer, indices: WebGLBuffer): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);
  gl.enableVertexAttribArray(ATTRIB.UV);
  gl.vertexAttribPointer(ATTRIB.UV, 2, gl.FLOAT, false, STRIDE_BYTES, UV_OFFSET_BYTES);
  // The VAO remembers the ELEMENT_ARRAY_BUFFER bound while it is bound.
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bindVertexArray(null);
  return vao;
}

// Step 5. Texture: load the image, then copy it to the GPU on FF's texture unit.
async function createTexture(gl: WebGL2RenderingContext, url: string, filter: number): Promise<WebGLTexture> {
  const image = new Image();
  image.src = url;
  await image.decode(); // wait until the image is fully loaded

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT); // FF samples this unit
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Image rows start at the top, but t = 0 is the bottom in GL. Flip the rows while uploading.
  // UNPACK_FLIP_Y_WEBGL is global state: it stays on for later uploads.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  // Filtering. MAG_FILTER applies when the texture is magnified (one texel covers many pixels, close up).
  // MIN_FILTER applies when it is minified (many texels per pixel, far away).
  // LINEAR blends neighbor texels. NEAREST picks one texel: it keeps pixel-art edges sharp and
  // does not blend the color of transparent texels into the edge (dark fringes).
  // The default MIN_FILTER needs mipmaps. Without them the texture samples as black, so set it.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  // Wrap: what to sample when s or t is outside [0, 1]. CLAMP_TO_EDGE uses the nearest edge texel.
  // Exercise: change the quad UVs to 0..2 and use gl.REPEAT.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Without mipmaps, a minified texture shimmers (aliasing).
  // Exercise: call gl.generateMipmap(gl.TEXTURE_2D), then set only TEXTURE_MIN_FILTER to LINEAR_MIPMAP_LINEAR.
  // Do not pass it as filter: TEXTURE_MAG_FILTER accepts only NEAREST or LINEAR.
  return texture;
}

// Step 6. Pipeline state: canvas size, viewport, clear color, depth test, face culling, blending.
function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST); // new vs. the triangle: nearer faces must hide farther ones
  gl.enable(gl.CULL_FACE); // skip back faces; front faces are counter-clockwise (the default)
  // FF outputs the alpha (texture alpha * material alpha), but blending is pipeline state, so the app sets it
  // (like glEnable(GL_BLEND) in GL2). Result = src * alpha + dst * (1 - alpha). Opaque draws have alpha 1: unchanged.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

// Step 7. Scene: lighting, one directional light, texturing, camera. The material is set before each draw.
function setupScene(ff: FixedFunction): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([0.2, 0.2, 0.2, 1]); // the FF default, set explicitly to make it visible

  // The light TRAVELS in direction (-1, -1, -0.5): down, left, slightly away from the camera.
  // FF's position (w = 0) points TOWARD the light, so the sign flips: (1, 1, 0.5, 0).
  // Passing the travel direction instead lights the faces that point away from the light.
  ff.setLight(0, { position: [1, 1, 0.5, 0], diffuse: [1, 1, 1, 1] });
  ff.enableLight(0);

  ff.enable(TEXTURE_2D); // FF samples the texture bound to TEXTURE_UNIT

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
const state = { angle: 0, rotating: true, quadColorIndex: 0 };

// Input: the keydown listener only records presses. processInput handles them later, once per frame.
let rPressed = false;
let cPressed = false;

function setupInput(): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // holding a key counts as one press
    if (e.code === 'KeyR') rPressed = true;
    if (e.code === 'KeyC') cPressed = true;
  });
  // Research: key-state polling with edge detection. Store which keys are down, and compare with
  // the last frame: pressed = down now && !down last frame. When does it fit better than events?
}

// Loop phase 1. R toggles the rotation. C selects the next quad color.
// The flag is cleared after use, so each press counts once.
function processInput(): void {
  if (rPressed) state.rotating = !state.rotating;
  rPressed = false;
  if (cPressed) state.quadColorIndex = (state.quadColorIndex + 1) % QUAD_COLORS.length;
  cPressed = false;
}

// Loop phase 2.
function update(dt: number): void {
  if (state.rotating) state.angle += ROTATION_SPEED * dt; // paused: the angle keeps its value
}

// Loop phase 3. Draw the current state. render reads the state and never changes it.
// Before each draw, render binds that object's texture, sets its material, and sets its matrices.
const model = mat4.create();
const normalMatrix = mat3.create();

function render(
  gl: WebGL2RenderingContext,
  ff: FixedFunction,
  cubeVao: WebGLVertexArrayObject,
  quadVao: WebGLVertexArrayObject,
  woodTexture: WebGLTexture,
  camoTexture: WebGLTexture,
  bushTexture: WebGLTexture,
): void {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Texturing multiplies the lit material color by the texel, per channel.
  // A white material (1, 1, 1) leaves the texture untinted. Lighting still shades it.

  // Cube: wood texture, white material.
  // bindTexture acts on the active unit, still TEXTURE_UNIT from createTexture.
  // FF samples the texture bound there at draw time.
  gl.bindTexture(gl.TEXTURE_2D, woodTexture);
  // setMaterial changes only the fields you pass, and the material persists.
  // Reset emissive: the bush (below) set it to white last frame.
  ff.setMaterial({ ambient: [1, 1, 1, 1], diffuse: [1, 1, 1, 1], emissive: [0, 0, 0, 1] });
  // Translate first, then rotate: the matrix is T * R, so the cube spins around its own center, then moves to CUBE_X.
  mat4.fromTranslation(model, [CUBE_X, 0, 0]);
  mat4.rotateY(model, model, state.angle);
  ff.setModelMatrix(model);
  // FF needs the normal matrix for lit normals: setModelMatrix does not update it.
  ff.setNormalMatrix(mat3.normalFromMat4(normalMatrix, model));
  gl.bindVertexArray(cubeVao);
  ff.drawElements(gl.TRIANGLES, CUBE_INDICES.length, gl.UNSIGNED_SHORT, 0);

  // Quad: camo texture, material color chosen with the C key. No rotation.
  const color = QUAD_COLORS[state.quadColorIndex];
  gl.bindTexture(gl.TEXTURE_2D, camoTexture);
  // A yellow material (1, 1, 0) has no blue, so the result has no blue: white texels turn yellow,
  // gray texels turn dark yellow (olive).
  // No emissive: lighting scales the texture, so the camo is dimmer than the bush. The README derives the lit value.
  ff.setMaterial({ ambient: color, diffuse: color, emissive: [0, 0, 0, 1] });
  mat4.fromTranslation(model, [QUAD_X, 0, 0]);
  ff.setModelMatrix(model);
  ff.setNormalMatrix(mat3.normalFromMat4(normalMatrix, model));
  gl.bindVertexArray(quadVao);
  ff.drawElements(gl.TRIANGLES, QUAD_INDICES.length, gl.UNSIGNED_SHORT, 0);

  // Bush: transparent texture, always white material (alpha 1), so only the texture alpha decides.
  // Draw transparent objects after the opaque ones: blending needs the colors already in the framebuffer.
  // Transparent texels still write depth, so anything drawn later behind them would be hidden.
  // Exercise: draw a second bush behind the first one. Research: depth mask, sorting back to front, discard.
  gl.bindTexture(gl.TEXTURE_2D, bushTexture);
  // Emissive is added to the lit color, and FF clamps the sum to 1 once, at the end.
  // White emissive therefore gives 1, so the texture shows its own colors whatever the light does.
  ff.setMaterial({ ambient: [1, 1, 1, 1], diffuse: [1, 1, 1, 1], emissive: [1, 1, 1, 1] });
  // Translate first, then scale: the quad is stretched to the image's aspect, then moved to BUSH_X.
  mat4.fromTranslation(model, [BUSH_X, 0, 0]);
  mat4.scale(model, model, [BUSH_ASPECT, 1, 1]);
  ff.setModelMatrix(model);
  // normalFromMat4 (inverse transpose) keeps the normal correct under a non-uniform scale.
  ff.setNormalMatrix(mat3.normalFromMat4(normalMatrix, model));
  gl.bindVertexArray(quadVao); // same quad data, so the same VAO
  ff.drawElements(gl.TRIANGLES, QUAD_INDICES.length, gl.UNSIGNED_SHORT, 0);
}

async function run(canvas: HTMLCanvasElement): Promise<void> {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: true });
  const cubeVertices = createVertexBuffer(gl, CUBE_VERTICES);
  const cubeIndices = createIndexBuffer(gl, CUBE_INDICES);
  const cubeVao = createVAO(gl, cubeVertices, cubeIndices);
  // The quad has the same vertex layout as the cube, so createVAO works unchanged.
  const quadVertices = createVertexBuffer(gl, QUAD_VERTICES);
  const quadIndices = createIndexBuffer(gl, QUAD_INDICES);
  const quadVao = createVAO(gl, quadVertices, quadIndices);
  // The loop starts only after all textures are ready.
  const woodTexture = await createTexture(gl, woodUrl, gl.LINEAR);
  const camoTexture = await createTexture(gl, camoUrl, gl.LINEAR);
  const bushTexture = await createTexture(gl, bushUrl, gl.NEAREST); // pixel art: keep the texels sharp
  setupState(gl, canvas);
  setupScene(ff);
  setupInput();

  let last: number | null = null; // set by the first frame, so dt starts at 0
  function frame(now: number): void {
    if (last === null) last = now;
    // rAF pauses in hidden tabs. On return, (now - last) would be huge, so cap dt.
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    processInput();
    update(dt);
    render(gl, ff, cubeVao, quadVao, woodTexture, camoTexture, bushTexture);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Page scaffolding: create the canvas and start the textured cube and quads.
const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas).catch(console.error);
