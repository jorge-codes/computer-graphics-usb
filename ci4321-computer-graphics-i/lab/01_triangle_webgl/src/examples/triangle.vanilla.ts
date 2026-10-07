// RGB triangle, vanilla WebGL2 version.
// Every pipeline step is visible, including the shaders FF hides. Compare with triangle.ff.ts.
import { CANVAS_SIZE, CLEAR_COLOR, COLOR_OFFSET_BYTES, STRIDE_BYTES, TRIANGLE } from './shared';

// Attribute slots. They match the layout(location = N) lines in the vertex shader.
const ATTRIB = { POSITION: 0, COLOR: 2 } as const;

// Vertex shader: runs once per vertex. It outputs a clip-space position and passes the color on.
const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 2) in vec4 a_color;

out vec4 v_color;

void main() {
  gl_Position = vec4(a_position, 1.0);
  v_color = a_color;
}
`;

// Fragment shader: runs once per pixel inside the triangle.
// v_color arrives interpolated from the three vertex colors.
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = v_color;
}
`;

// Step 1. Get the WebGL2 context.
function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is not available.');
  return gl;
}

// Step 2a. Compile one shader stage from GLSL source.
function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed:\n${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

// Step 2b. Link the vertex and fragment stages into one program.
function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed:\n${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

// Step 3. Vertex specification: copy the vertex data to the GPU.
function createVertexBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

// Step 4. Describe how the vertex data is laid out, using the attribute slots above.
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

// Step 6. Draw. Rasterization and fragment shading happen inside drawArrays.
function draw(gl: WebGL2RenderingContext, program: WebGLProgram, vao: WebGLVertexArrayObject): void {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function run(canvas: HTMLCanvasElement): void {
  const gl = getContext(canvas);
  const program = createProgram(gl);
  const buffer = createVertexBuffer(gl, TRIANGLE);
  const vao = createVAO(gl, buffer);
  setupState(gl, canvas);
  draw(gl, program, vao);
}
