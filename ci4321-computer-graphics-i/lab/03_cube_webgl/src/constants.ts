// Scene constants: geometry, colors and canvas settings. main.ts holds the WebGL code and the game loop.

/** Background color #1b1e2b as linear floats in [0, 1]. */
export const CLEAR_COLOR: readonly [number, number, number, number] = [0x1b / 255, 0x1e / 255, 0x2b / 255, 1];

/** Drawing buffer size in pixels, 4:3. CSS scales the canvas to fit the window; the buffer stays fixed. */
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

/** Cube colors, RGBA. Space cycles through them in this order. */
export const COLORS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 1, 1], // cyan
  [1, 0, 1, 1], // magenta
  [1, 1, 0, 1], // yellow
];

// 24 vertices (4 per face), not 8 corners. A corner is shared by 3 faces, but a vertex holds
// only one normal. Each face needs its own normal for flat lighting, so each face gets its own 4 vertices.
/** Interleaved vertex data: x, y, z, nx, ny, nz per vertex. Half-size 0.5, counter-clockwise seen from outside. */
export const CUBE_VERTICES = new Float32Array([
  //   x      y      z    nx  ny  nz
  // +Z face (front)
  -0.5, -0.5,  0.5,   0,  0,  1, // bottom left
   0.5, -0.5,  0.5,   0,  0,  1, // bottom right
   0.5,  0.5,  0.5,   0,  0,  1, // top right
  -0.5,  0.5,  0.5,   0,  0,  1, // top left
  // -Z face (back)
   0.5, -0.5, -0.5,   0,  0, -1,
  -0.5, -0.5, -0.5,   0,  0, -1,
  -0.5,  0.5, -0.5,   0,  0, -1,
   0.5,  0.5, -0.5,   0,  0, -1,
  // +X face (right)
   0.5, -0.5,  0.5,   1,  0,  0,
   0.5, -0.5, -0.5,   1,  0,  0,
   0.5,  0.5, -0.5,   1,  0,  0,
   0.5,  0.5,  0.5,   1,  0,  0,
  // -X face (left)
  -0.5, -0.5, -0.5,  -1,  0,  0,
  -0.5, -0.5,  0.5,  -1,  0,  0,
  -0.5,  0.5,  0.5,  -1,  0,  0,
  -0.5,  0.5, -0.5,  -1,  0,  0,
  // +Y face (top)
  -0.5,  0.5,  0.5,   0,  1,  0,
   0.5,  0.5,  0.5,   0,  1,  0,
   0.5,  0.5, -0.5,   0,  1,  0,
  -0.5,  0.5, -0.5,   0,  1,  0,
  // -Y face (bottom)
  -0.5, -0.5, -0.5,   0, -1,  0,
   0.5, -0.5, -0.5,   0, -1,  0,
   0.5, -0.5,  0.5,   0, -1,  0,
  -0.5, -0.5,  0.5,   0, -1,  0,
]);

/** Two triangles per face, 36 indices. Each face: (0, 1, 2) and (0, 2, 3), both counter-clockwise. */
export const CUBE_INDICES = new Uint16Array([
   0,  1,  2,   0,  2,  3, // +Z
   4,  5,  6,   4,  6,  7, // -Z
   8,  9, 10,   8, 10, 11, // +X
  12, 13, 14,  12, 14, 15, // -X
  16, 17, 18,  16, 18, 19, // +Y
  20, 21, 22,  20, 22, 23, // -Y
]);

export const STRIDE_BYTES = 6 * 4; // 4 bytes per float (Float32)
export const NORMAL_OFFSET_BYTES = 3 * 4;
