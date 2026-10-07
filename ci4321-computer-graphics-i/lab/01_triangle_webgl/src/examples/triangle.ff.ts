// RGB triangle, FixedFunction (FF) version.
// FF hides the shaders. Compare with triangle.vanilla.ts, which shows them.
import { ATTRIB, createFixedFunction, LIGHTING } from '../vendor/ff/ff';
import { CANVAS_SIZE, CLEAR_COLOR, COLOR_OFFSET_BYTES, STRIDE_BYTES, TRIANGLE } from './shared';

// Step 1. Get the WebGL2 context.
function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is not available.');
  return gl;
}

// Step 2. Shaders and program: FF creates and owns them.
// Step 3. Vertex specification: copy the vertex data to the GPU.
function createVertexBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

// Step 4. Describe how the vertex data is laid out, using FF's attribute slots.
function createVAO(gl: WebGL2RenderingContext, buffer: WebGLBuffer): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.COLOR);
  gl.vertexAttribPointer(ATTRIB.COLOR, 4, gl.FLOAT, false, STRIDE_BYTES, COLOR_OFFSET_BYTES);
  gl.bindVertexArray(null);
  return vao;
}

// Step 5. Pipeline state: canvas size, viewport, clear color.
function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
}

// Step 6. Draw. ff.drawArrays binds the FF program and uploads its uniforms first.
function draw(gl: WebGL2RenderingContext, ff: ReturnType<typeof createFixedFunction>, vao: WebGLVertexArrayObject): void {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindVertexArray(vao);
  ff.drawArrays(gl.TRIANGLES, 0, 3);
}

export function run(canvas: HTMLCanvasElement): void {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: true });
  ff.disable(LIGHTING); // unlit: the output is the per-vertex color
  const buffer = createVertexBuffer(gl, TRIANGLE);
  const vao = createVAO(gl, buffer);
  setupState(gl, canvas);
  draw(gl, ff, vao);
}
