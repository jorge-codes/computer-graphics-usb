// Scene constants: geometry and canvas settings. main.ts holds the WebGL code and the game loop.

/** Background color #1b1e2b as linear floats in [0, 1]. */
export const CLEAR_COLOR: readonly [number, number, number, number] = [0x1b / 255, 0x1e / 255, 0x2b / 255, 1];

/** Drawing buffer size in pixels, 4:3. CSS scales the canvas to fit the window; the buffer stays fixed. */
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

// 24 vertices (4 per face), not 8 corners. A corner is shared by 3 faces, but a vertex holds
// only one normal. Each face needs its own normal for flat lighting, so each face gets its own 4 vertices.
// The same reason applies to texture coordinates: a corner has a different (s, t) on each face it touches.
// Each face maps the full image: bottom left (0, 0), bottom right (1, 0), top right (1, 1), top left (0, 1).
/** Interleaved vertex data: x, y, z, nx, ny, nz, s, t per vertex. Half-size 0.5, counter-clockwise seen from outside. */
export const CUBE_VERTICES = new Float32Array([
  //   x      y      z    nx  ny  nz    s  t
  // +Z face (front)
  -0.5, -0.5,  0.5,   0,  0,  1,   0, 0, // bottom left
   0.5, -0.5,  0.5,   0,  0,  1,   1, 0, // bottom right
   0.5,  0.5,  0.5,   0,  0,  1,   1, 1, // top right
  -0.5,  0.5,  0.5,   0,  0,  1,   0, 1, // top left
  // -Z face (back)
   0.5, -0.5, -0.5,   0,  0, -1,   0, 0,
  -0.5, -0.5, -0.5,   0,  0, -1,   1, 0,
  -0.5,  0.5, -0.5,   0,  0, -1,   1, 1,
   0.5,  0.5, -0.5,   0,  0, -1,   0, 1,
  // +X face (right)
   0.5, -0.5,  0.5,   1,  0,  0,   0, 0,
   0.5, -0.5, -0.5,   1,  0,  0,   1, 0,
   0.5,  0.5, -0.5,   1,  0,  0,   1, 1,
   0.5,  0.5,  0.5,   1,  0,  0,   0, 1,
  // -X face (left)
  -0.5, -0.5, -0.5,  -1,  0,  0,   0, 0,
  -0.5, -0.5,  0.5,  -1,  0,  0,   1, 0,
  -0.5,  0.5,  0.5,  -1,  0,  0,   1, 1,
  -0.5,  0.5, -0.5,  -1,  0,  0,   0, 1,
  // +Y face (top)
  -0.5,  0.5,  0.5,   0,  1,  0,   0, 0,
   0.5,  0.5,  0.5,   0,  1,  0,   1, 0,
   0.5,  0.5, -0.5,   0,  1,  0,   1, 1,
  -0.5,  0.5, -0.5,   0,  1,  0,   0, 1,
  // -Y face (bottom)
  -0.5, -0.5, -0.5,   0, -1,  0,   0, 0,
   0.5, -0.5, -0.5,   0, -1,  0,   1, 0,
   0.5, -0.5,  0.5,   0, -1,  0,   1, 1,
  -0.5, -0.5,  0.5,   0, -1,  0,   0, 1,
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

// The quad is one 1 x 1 square in the XY plane at z = 0. Its normal is +Z and it is counter-clockwise seen from the front.
// It uses the same layout as the cube (x, y, z, nx, ny, nz, s, t), so STRIDE_BYTES and the offsets below apply to it too.
/** Interleaved vertex data for the quad: x, y, z, nx, ny, nz, s, t per vertex. */
export const QUAD_VERTICES = new Float32Array([
  //   x      y     z    nx  ny  nz    s  t
  -0.5, -0.5,  0,    0,  0,  1,   0, 0, // bottom left
   0.5, -0.5,  0,    0,  0,  1,   1, 0, // bottom right
   0.5,  0.5,  0,    0,  0,  1,   1, 1, // top right
  -0.5,  0.5,  0,    0,  0,  1,   0, 1, // top left
]);

/** Two counter-clockwise triangles: (0, 1, 2) and (0, 2, 3). */
export const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

/** Quad material colors (r, g, b, a). The C key cycles through them in order: white, yellow. */
export const QUAD_COLORS: readonly (readonly [number, number, number, number])[] = [
  [1, 1, 1, 1], // white: the texture is not tinted
  [1, 1, 0, 1], // yellow: no blue, so the texture loses its blue channel
];

/** World X position of each object: the camo quad on the left, the bush in the middle, the cube on the right. */
export const CUBE_X = 1.3;
export const QUAD_X = -1.4;
export const BUSH_X = -0.1;

/** Bush image width / height in pixels (53 x 42). The bush quad is scaled by this in X, so the image is not squashed. */
export const BUSH_ASPECT = 53 / 42;

export const STRIDE_BYTES = 8 * 4; // 4 bytes per float (Float32)
export const NORMAL_OFFSET_BYTES = 3 * 4;
export const UV_OFFSET_BYTES = 6 * 4;
