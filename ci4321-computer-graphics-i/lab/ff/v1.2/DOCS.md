# FixedFunction (FF) usage guide and API reference

FixedFunction (FF) version 1.2.0 emulates the OpenGL 2 fixed-function pipeline on WebGL2. FF creates and owns the shader program. You set state with function calls. FF uploads that state as uniforms when you draw.

The shaders are in [`ff.vert.glsl`](./ff.vert.glsl) and [`ff.frag.glsl`](./ff.frag.glsl). Read them to see the exact lighting, texturing and fog math.

## Table of contents

- [Overview](#overview)
- [Initialization](#initialization)
- [Basic usage](#basic-usage)
  - [Unlit draw](#unlit-draw)
  - [Lit draw](#lit-draw)
  - [Textured draw](#textured-draw)
  - [Fog draw](#fog-draw)
  - [Sprite font draw](#sprite-font-draw)
  - [Dirty state and flush](#dirty-state-and-flush)
- [Default state](#default-state)
- [API reference](#api-reference)
  - [Creation](#creation)
  - [Capabilities](#capabilities)
  - [Current vertex attributes](#current-vertex-attributes)
  - [Transformation matrices](#transformation-matrices)
  - [Lighting](#lighting)
  - [Material](#material)
  - [Texturing](#texturing)
  - [Fog](#fog)
  - [Drawing](#drawing)
  - [Introspection](#introspection)
  - [Instance properties](#instance-properties)
  - [Constants](#constants)
  - [Types](#types)
- [Lighting model](#lighting-model)
- [Debug warnings](#debug-warnings)
- [Errors](#errors)
- [Version roadmap](#version-roadmap)
- [Upgrading from v1.0](#upgrading-from-v10)

## Overview

FF v1.2.0 supports:

- Unlit drawing with per-vertex color.
- Matrix transforms: projection, view and model, plus a normal matrix and a texture matrix.
- Up to eight lights (`maxLights` is 8). Each light is directional, point or spot.
- Distance attenuation for point and spot lights.
- One material, with ambient, diffuse, specular, shininess and emissive.
- Per-vertex (Gouraud) lighting in world space.
- Phong specular reflection, added after texturing.
- 2D texturing on texture unit 0, with texture alpha.
- Linear fog, for lit and unlit draws.

FF v1.2.0 does not support:

- More than one texture unit. Only `TEXTURE_UNIT` (`0`) is sampled.
- Texture environment modes other than modulate.
- Fog modes other than linear.
- Two-sided lighting. FF lights front faces only.
- The Blinn half-vector. FF uses the Phong reflection vector.
- Per-fragment lighting.
- A matrix stack or immediate mode.
- Alpha test (`GL_ALPHA_TEST`). Transparent texels still write depth.
- Blending, depth test and face culling as FF state. Set them with WebGL calls, for example `gl.enable(gl.BLEND)`.
- Text or sprite helpers. Build glyph quads in your code. See [Sprite font draw](#sprite-font-draw).

## Initialization

### Requirements

1. Use a WebGL2 context.
2. Install `gl-matrix`. FF uses it for matrix math.
3. Use a bundler that supports `?raw` imports, such as Vite. FF imports the shader files with `?raw`.

### Steps

1. Get a WebGL2 context from the canvas.
2. Import `createFixedFunction`.
3. Call `createFixedFunction(gl, options)`. Store the returned object.

```ts
import { createFixedFunction } from '../vendor/ff/ff';

const gl = canvas.getContext('webgl2');
if (!gl) throw new Error('WebGL2 is not available.');

const ff = createFixedFunction(gl, { debug: true });
```

The `debug` option turns on usage checks. Set `debug: true` during development. The default is `false`. See [Debug warnings](#debug-warnings).

`createFixedFunction` throws an `Error` if the shaders do not compile or the program does not link. See [Errors](#errors).

## Basic usage

FF reads vertex data from fixed attribute slots. Use the `ATTRIB` constants to bind your buffers:

| Constant | Slot | Data | Shader input |
|---|---|---|---|
| `ATTRIB.POSITION` | 0 | 3 floats, `x y z` | `a_position` (`vec3`) |
| `ATTRIB.NORMAL` | 1 | 3 floats, `nx ny nz` | `a_normal` (`vec3`) |
| `ATTRIB.COLOR` | 2 | 4 floats, `r g b a` | `a_color` (`vec4`) |
| `ATTRIB.UV` | 3 | 2 floats, `s t` | `a_uv` (`vec2`) |

Bind the buffers in a vertex array object (VAO). Your code owns the VAO. FF does not bind VAOs.

### Unlit draw

This example draws one triangle with per-vertex color. It is based on `src/examples/triangle.ff.ts`.

Lighting is off by default. The `ff.disable(LIGHTING)` call from `triangle.ff.ts` is optional.

1. Create the vertex buffer.

```ts
import { ATTRIB, createFixedFunction, LIGHTING } from '../vendor/ff/ff';

const gl = canvas.getContext('webgl2')!;
const ff = createFixedFunction(gl, { debug: true });
ff.disable(LIGHTING); // Optional. Lighting is off by default.

// Interleaved data: x, y, z, r, g, b, a per vertex.
const STRIDE_BYTES = 7 * 4;
const COLOR_OFFSET_BYTES = 3 * 4;
const data = new Float32Array([
   0.0,  0.7, 0.0,  1, 0, 0, 1, // top: red
  -0.7, -0.6, 0.0,  0, 1, 0, 1, // bottom left: green
   0.7, -0.6, 0.0,  0, 0, 1, 1, // bottom right: blue
]);

const buffer = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
```

2. Create the VAO and map the attributes.

```ts
const vao = gl.createVertexArray()!;
gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.enableVertexAttribArray(ATTRIB.POSITION);
gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
gl.enableVertexAttribArray(ATTRIB.COLOR);
gl.vertexAttribPointer(ATTRIB.COLOR, 4, gl.FLOAT, false, STRIDE_BYTES, COLOR_OFFSET_BYTES);
gl.bindVertexArray(null);
```

3. Set the viewport and clear, then draw.

```ts
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0x1b / 255, 0x1e / 255, 0x2b / 255, 1);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.bindVertexArray(vao);
ff.drawArrays(gl.TRIANGLES, 0, 3);
```

`drawArrays` calls `flush()` before the draw call. You do not need to call `flush()` here.

### Lit draw

This example adds one directional light and one material. The model matrix is rotated, so the normal matrix must be set too.

1. Create the vertex buffer with positions and normals.

```ts
import { mat3, mat4 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING } from '../vendor/ff/ff';

const gl = canvas.getContext('webgl2')!;
const ff = createFixedFunction(gl, { debug: true });

// Interleaved data: x, y, z, nx, ny, nz per vertex.
const STRIDE_BYTES = 6 * 4;
const NORMAL_OFFSET_BYTES = 3 * 4;
const data = new Float32Array([
   0.0,  0.7, 0.0,  0, 0, 1,
  -0.7, -0.6, 0.0,  0, 0, 1,
   0.7, -0.6, 0.0,  0, 0, 1,
]);

const buffer = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
```

2. Create the VAO. Do not enable `ATTRIB.COLOR`. Lit colors come from the material.

```ts
const vao = gl.createVertexArray()!;
gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.enableVertexAttribArray(ATTRIB.POSITION);
gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
gl.enableVertexAttribArray(ATTRIB.NORMAL);
gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);
gl.bindVertexArray(null);
```

3. Turn on lighting. Set the light, then enable it.

```ts
ff.enable(LIGHTING);
ff.setGlobalAmbient([0.2, 0.2, 0.2, 1]);

// position: world space. w = 0 marks a directional light. xyz points toward the light.
ff.setLight(0, {
  position: [0, 0, 1, 0],
  diffuse: [1, 1, 1, 1],
  specular: [1, 1, 1, 1],
});
ff.enableLight(0);
```

4. Set the material.

```ts
ff.setMaterial({
  ambient: [0.2, 0.2, 0.2, 1],
  diffuse: [0.8, 0.5, 0.2, 1],
  specular: [1, 1, 1, 1],
  shininess: 32,
});
```

5. Set the model matrix and the normal matrix. Set both every time the model matrix changes.

```ts
const angle = 0.5; // radians
const model = mat4.create();
mat4.rotateY(model, model, angle);

ff.setModelMatrix(model);

// Normal matrix: inverse transpose of the upper 3x3 of the model matrix.
const normalMatrix = mat3.normalFromMat4(mat3.create(), model);
ff.setNormalMatrix(normalMatrix);
```

`setModelMatrix` does not update the normal matrix. If you skip `setNormalMatrix`, lit normals use the old transform. Debug mode warns about this. See [Debug warnings](#debug-warnings).

6. Set the view and projection matrices, then draw.

```ts
ff.setViewMatrix(view);             // mat4, for example from mat4.lookAt
ff.setProjectionMatrix(projection); // mat4, for example from mat4.perspective

gl.viewport(0, 0, canvas.width, canvas.height);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindVertexArray(vao);
ff.drawArrays(gl.TRIANGLES, 0, 3);
```

`view` and `projection` are `mat4` values that your code creates. The example uses gl-matrix functions to create them.

7. Add a point light and a spot light (optional). Lights 1 to 7 start with black diffuse and specular. Set those fields, or the light does not show.

```ts
// Point light: w = 1. Attenuation: 1 / (kc + kl * d + kq * d * d).
ff.setLight(1, {
  position: [2, 3, 1, 1],
  diffuse: [1, 0.9, 0.7, 1],
  specular: [1, 0.9, 0.7, 1],
  constantAttenuation: 1,
  linearAttenuation: 0.1,
  quadraticAttenuation: 0.01,
});
ff.enableLight(1);

// Spot light: a positional light inside a cone. spotCutoff is the half-angle in radians.
ff.setLight(2, {
  position: [0, 4, 0, 1],
  diffuse: [0, 0.5, 1, 1],
  specular: [0, 0.5, 1, 1],
  spotDirection: [0, -1, 0], // world space. FF normalizes it.
  spotCutoff: Math.PI / 6,   // 30 degrees
  spotExponent: 8,
});
ff.enableLight(2);
```

Positional lights use the world-space `position` as given. FF does not transform it with any matrix.

### Textured draw

This example draws the triangle with a texture on unit 0. You create and bind the texture. FF does not bind or create textures.

1. Create the texture on unit 0. `TEXTURE_UNIT` is `0`, so `gl.TEXTURE0` is the unit that FF samples.

```ts
gl.activeTexture(gl.TEXTURE0);
const texture = gl.createTexture()!;
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); // image: a loaded HTMLImageElement
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
```

Set `TEXTURE_MIN_FILTER` to `LINEAR` or `NEAREST`. The default value needs mipmaps. Without mipmaps, the texture samples as black.

2. Create the VAO with texture coordinates. Interleave `x, y, z, s, t` per vertex.

```ts
const STRIDE_BYTES = 5 * 4;
const UV_OFFSET_BYTES = 3 * 4;
const data = new Float32Array([
   0.0,  0.7, 0.0,  0.5, 1.0,
  -0.7, -0.6, 0.0,  0.0, 0.0,
   0.7, -0.6, 0.0,  1.0, 0.0,
]);

const buffer = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

const vao = gl.createVertexArray()!;
gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.enableVertexAttribArray(ATTRIB.POSITION);
gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
gl.enableVertexAttribArray(ATTRIB.UV);
gl.vertexAttribPointer(ATTRIB.UV, 2, gl.FLOAT, false, STRIDE_BYTES, UV_OFFSET_BYTES);
gl.bindVertexArray(null);
```

3. Enable texturing, then draw. Texturing multiplies the lit or unlit color. Texture alpha multiplies the output alpha.

```ts
import { ATTRIB, createFixedFunction, TEXTURE_2D } from '../vendor/ff/ff';

ff.enable(TEXTURE_2D);

gl.bindVertexArray(vao);
ff.drawArrays(gl.TRIANGLES, 0, 3);
```

Optional: call `setTextureMatrix` with a `mat3` to transform the UVs. The default is the identity. For example, `mat3.fromScaling(mat3.create(), [2, 2])` doubles the UV values.

### Fog draw

Fog blends the final color toward the fog color. The blend depends on the eye-space distance of each vertex. Fog applies to lit and unlit draws.

1. Set the fog parameters, then enable fog. `end` must be greater than `start`.

```ts
ff.setFog({
  color: [0.1, 0.1, 0.15, 1],
  start: 10, // no fog at or closer than this distance
  end: 40,   // full fog at or beyond this distance
});
ff.enable(FOG);
```

2. Draw the scene with fog on.

3. Disable fog before a HUD pass. HUD and overlay geometry must not fog.

```ts
ff.disable(FOG);
// Draw the HUD here.
```

### Sprite font draw

A sprite font is a texture atlas (also called a spritesheet) that holds one image per character (a glyph). To draw text, draw one textured quad per character. Each quad samples only the sub-rectangle of its glyph. FF supports this with `ATTRIB.UV` and `setTextureMatrix`. FF has no text API, so your code builds the quads.

You do not change FF to draw text or a UI. FF draws textured quads with any projection. Everything else is your code:

| FF does | Your code does |
|---|---|
| Transforms positions with the projection, view and model matrices | Creates the orthographic (2D) projection with `mat4.ortho` |
| Applies the texture matrix to the UVs | Computes the UV rectangle of each glyph from the atlas layout |
| Samples the texture on unit 0 and multiplies it by the current color (modulate) | Prepares the atlas: white glyphs on a transparent background |
| Outputs texture alpha times color alpha | Enables blending and sets the blend function with WebGL |
| Switches lighting, fog and texturing on and off | Builds one quad (two triangles) per character, with its buffers and VAO |
| Draws with `drawArrays` and `drawElements` | Sets the depth test and face culling, and restores the 3D state after the text pass |

This example draws HUD (heads-up display) text in pixel coordinates over a 3D scene. It assumes a monospaced atlas: a grid of `COLS` columns of cells. Each glyph is `CELL_W` x `CELL_H` pixels. The cell at index `code - FIRST_CODE` holds the character `code`, in row-major order from the top-left cell.

Some atlases draw a grid line around each cell. Then the cells repeat every `PITCH_X` x `PITCH_Y` pixels, and the first glyph starts `BORDER` pixels from the top-left corner. For an atlas without lines, set `PITCH_X = CELL_W`, `PITCH_Y = CELL_H` and `BORDER = 0`. Open the atlas in an image editor and measure these values before you write the UV code.

```ts
const ATLAS_W = 145;    // atlas image width in pixels
const ATLAS_H = 1412;   // atlas image height in pixels
const CELL_W = 8;       // glyph width in pixels
const CELL_H = 16;      // glyph height in pixels
const PITCH_X = 9;      // distance from one cell to the next in x: glyph + 1 pixel grid line
const PITCH_Y = 17;     // distance from one cell to the next in y
const BORDER = 1;       // pixels before the first glyph: the outer grid line
const COLS = 16;        // cells per row
const FIRST_CODE = 32;  // the top-left cell holds ' ' (ASCII 32)
```

These values match the BoldPixels atlas in the `05_texture_webgl` example.

1. Prepare the atlas image. Do this once, in an image editor or with a script, not in the render loop. The glyphs must be white, and the rest of the image must be transparent (alpha 0).

FF computes `texel x color`. The table shows why this format is necessary:

| Atlas format | Result of `texel x color` | Usable |
|---|---|---|
| Black glyphs on white, opaque | Glyphs stay black for every color. The white background shows as a box around each glyph. | No |
| Black glyphs on a transparent background | Glyphs stay black for every color. Black text is not visible on a dark scene. | Only for black text |
| White glyphs on a transparent background | Glyphs take the color from `setColor`. The background does not show when blending is on. | Yes |

To convert a black-on-white atlas:

- Make every glyph pixel opaque white: `(255, 255, 255, 255)`.
- Make every other pixel transparent: alpha `0`. This includes the background and any grid lines.
- Keep the image size. Then the grid values above do not change.
- Save the result as a PNG with an alpha channel. Keep the original file.

With a white atlas, `ff.setColor([1, 1, 1, 1])` shows the glyphs as they are in the image. Any other color tints them.

2. Load the atlas on unit 0. Use `NEAREST` filtering and `CLAMP_TO_EDGE` wrapping.

```ts
gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
const fontTexture = gl.createTexture()!;
gl.bindTexture(gl.TEXTURE_2D, fontTexture);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // image row 0 goes to t = 1 (the top)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fontImage);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
```

`LINEAR` filtering and mipmaps blend texels from the neighbor cells into the glyph edges. The result is thin lines at the quad borders. If you need `LINEAR`, leave empty pixels (padding) between the cells in the atlas, or move each UV edge 0.5 texel toward the glyph center.

3. Compute the UV rectangle of a glyph. First find the glyph in pixels, then divide by the atlas size to get texture coordinates in `[0, 1]`. The image origin is the top-left corner, but `t = 0` is the bottom of the texture. The `t` values depend on `UNPACK_FLIP_Y_WEBGL`.

```ts
/** Returns [s0, t0, s1, t1]: (s0, t0) is the bottom-left corner, (s1, t1) is the top-right corner. */
function glyphUV(code: number): [number, number, number, number] {
  const index = code - FIRST_CODE;
  const col = index % COLS;
  const row = Math.floor(index / COLS); // row 0 is the top row of the image
  const x0 = BORDER + col * PITCH_X; // left pixel of the glyph
  const y0 = BORDER + row * PITCH_Y; // top pixel of the glyph
  const s0 = x0 / ATLAS_W;
  const s1 = (x0 + CELL_W) / ATLAS_W;
  // UNPACK_FLIP_Y_WEBGL = true: the top image row is at t = 1.
  const t1 = 1 - y0 / ATLAS_H;
  const t0 = 1 - (y0 + CELL_H) / ATLAS_H;
  // UNPACK_FLIP_Y_WEBGL = false: use t0 = (y0 + CELL_H) / ATLAS_H and t1 = y0 / ATLAS_H.
  return [s0, t0, s1, t1];
}
```

`UNPACK_FLIP_Y_WEBGL` is global WebGL state. It stays on for all uploads after you set it. Use the same value for all your textures, or set it before each upload.

4. Build the text mesh. Each character adds 4 vertices and 6 indices (two triangles). WebGL2 has no `QUADS` primitive.

```ts
const LETTER_SPACING = 1; // atlas pixels between glyphs. Use 0 if the glyphs already include a gap.

/** Interleaved x, y, s, t per vertex. (x, y) is the top-left corner of the text, in pixels, y down. */
function buildText(text: string, x: number, y: number, scale = 1) {
  const vertices = new Float32Array(text.length * 4 * 4);
  const indices = new Uint16Array(text.length * 6);
  const w = CELL_W * scale;
  const h = CELL_H * scale;
  const advance = (CELL_W + LETTER_SPACING) * scale; // distance from one glyph to the next
  for (let i = 0; i < text.length; i++) {
    const [s0, t0, s1, t1] = glyphUV(text.charCodeAt(i));
    const left = x + i * advance;
    const right = left + w;
    const top = y;
    const bottom = y + h;
    vertices.set([
      left,  bottom, s0, t0, // bottom left
      right, bottom, s1, t0, // bottom right
      right, top,    s1, t1, // top right
      left,  top,    s0, t1, // top left
    ], i * 16);
    const v = i * 4;
    indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
  }
  return { vertices, indices };
}
```

A `Uint16Array` index buffer holds up to 16,383 characters (65,535 / 4 vertices). Use an integer `scale` for pixel fonts, and round `x` and `y` to whole pixels. Then each atlas pixel covers exactly `scale` x `scale` screen pixels, and the glyphs stay sharp. For a variable-width font, store the pixel rectangle and the advance width of each glyph in a table. Then add the advance width of the previous glyph to `left`, not `i * advance`.

5. Create the buffers and the VAO. Use `DYNAMIC_DRAW` if the text changes often. The position has 2 floats. WebGL sets the missing `z` to `0`.

```ts
const TEXT_STRIDE_BYTES = 4 * 4;
const TEXT_UV_OFFSET_BYTES = 2 * 4;

const textVertexBuffer = gl.createBuffer()!;
const textIndexBuffer = gl.createBuffer()!;
const textVao = gl.createVertexArray()!;
gl.bindVertexArray(textVao);
gl.bindBuffer(gl.ARRAY_BUFFER, textVertexBuffer);
gl.enableVertexAttribArray(ATTRIB.POSITION);
gl.vertexAttribPointer(ATTRIB.POSITION, 2, gl.FLOAT, false, TEXT_STRIDE_BYTES, 0);
gl.enableVertexAttribArray(ATTRIB.UV);
gl.vertexAttribPointer(ATTRIB.UV, 2, gl.FLOAT, false, TEXT_STRIDE_BYTES, TEXT_UV_OFFSET_BYTES);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textIndexBuffer);
gl.bindVertexArray(null);

/** Uploads new text. Returns the index count for drawElements. */
function setText(text: string, x: number, y: number, scale = 1): number {
  const { vertices, indices } = buildText(text, x, y, scale);
  gl.bindBuffer(gl.ARRAY_BUFFER, textVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
  gl.bindVertexArray(textVao); // ELEMENT_ARRAY_BUFFER binds to the bound VAO
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
  gl.bindVertexArray(null);
  return indices.length;
}
```

The VAO does not enable `ATTRIB.COLOR`. All glyphs use the current color from `setColor`. To give each character its own color, add `r g b a` to each vertex and enable `ATTRIB.COLOR`.

6. Draw the 3D scene first. Then draw the text pass. Set the pipeline state for 2D, draw, then restore the state for the next frame.

```ts
import { mat3, mat4 } from 'gl-matrix';
import { ATTRIB, FOG, LIGHTING, TEXTURE_2D, TEXTURE_UNIT } from '../vendor/ff/ff';

const IDENTITY4 = mat4.create();
const IDENTITY3 = mat3.create();
// Pixel coordinates: (0, 0) is the top-left corner of the canvas, y points down.
const hudProjection = mat4.ortho(mat4.create(), 0, canvas.width, canvas.height, 0, -1, 1);

// Pipeline state (WebGL). FF does not manage it.
gl.disable(gl.DEPTH_TEST); // text is always on top, and transparent texels do not hide anything
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// FF state.
ff.disable(LIGHTING);       // the output is the current color times the texel
ff.disable(FOG);            // fog depends on the distance to the camera, not on the HUD
ff.enable(TEXTURE_2D);
ff.setProjectionMatrix(hudProjection);
ff.setViewMatrix(IDENTITY4);
ff.setModelMatrix(IDENTITY4);
ff.setTextureMatrix(IDENTITY3); // the UVs already select the glyph
ff.setColor([1, 1, 1, 1]);    // white: the glyphs show as they are in the atlas. Any other color tints them.

gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
gl.bindTexture(gl.TEXTURE_2D, fontTexture);
const count = setText(`Score: ${score}`, 16, 16, 2);
gl.bindVertexArray(textVao);
ff.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

// Restore the 3D state before the next frame.
gl.enable(gl.DEPTH_TEST);
ff.setProjectionMatrix(projection);
ff.setViewMatrix(view);
// Also enable LIGHTING and FOG again if your 3D scene uses them.
```

If the text pass does not know the scene state, save it with `getState()` before the pass and restore it after the pass:

```ts
const saved = ff.getState(); // a copy, not a live view
// ... text pass ...
if (saved.capabilities[LIGHTING]) ff.enable(LIGHTING);
if (saved.capabilities[FOG]) ff.enable(FOG);
if (!saved.capabilities[TEXTURE_2D]) ff.disable(TEXTURE_2D);
ff.setProjectionMatrix(saved.matrices.projection);
ff.setViewMatrix(saved.matrices.view);
ff.setColor([1, 1, 1, 1]); // FF's initial current color
```

`getState()` allocates new arrays on each call. One call per frame is acceptable. Do not call it once per character.

`buildText` lists the vertices of each quad counter-clockwise as seen on the screen. The projection maps the larger pixel `y` to the bottom of the screen, so the quads stay counter-clockwise. Face culling does not remove them. If you list the vertices in a different order, check the winding, or disable `CULL_FACE` for the text pass.

The atlas has white glyphs on a transparent background (step 1). The modulate step gives `texel x color`, so `setColor` sets the text color. Texel alpha times color alpha gives the output alpha. With blending on, the transparent part of each cell does not show.

To draw a UI panel behind the text, draw a quad with `ff.disable(TEXTURE_2D)` and a color with alpha below 1, for example `ff.setColor([0, 0, 0, 0.6])`. Draw the panel before the text, then enable `TEXTURE_2D` again.

`setColor` writes the generic value of `ATTRIB.COLOR` right away. It has no effect while a VAO enables `ATTRIB.COLOR`. Lit draws ignore it unless `COLOR_MATERIAL` is on. See [setColor](#setcolor).

#### Alternative: one quad and the texture matrix

You can select the glyph with the texture matrix instead of per-vertex UVs. Use one unit quad with UVs from `(0, 0)` to `(1, 1)`. Before each character, scale the UVs to the cell size, then move them to the cell corner.

The quad covers `x` from `0` to `1` and `y` from `0` (top) to `1` (bottom), for the y-down projection in step 6. Its top edge has `t = 1`, so the glyph is not upside down. Create its VAO the same way as in step 5, with `STATIC_DRAW`.

```ts
// x, y, s, t per vertex. Counter-clockwise as seen on the screen.
const GLYPH_QUAD_VERTICES = new Float32Array([
  0, 1,  0, 0, // bottom left
  1, 1,  1, 0, // bottom right
  1, 0,  1, 1, // top right
  0, 0,  0, 1, // top left
]);
const GLYPH_QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);
```

Set the same text-pass state as in step 6. Then select each glyph and draw the quad.

```ts
const textureMatrix = mat3.create();
const model = mat4.create();

function selectGlyph(code: number): void {
  const [s0, t0] = glyphUV(code);
  // T = translate(s0, t0) * scale(CELL_W / ATLAS_W, CELL_H / ATLAS_H). FF computes T * (s, t, 1).
  mat3.fromTranslation(textureMatrix, [s0, t0]);
  mat3.scale(textureMatrix, textureMatrix, [CELL_W / ATLAS_W, CELL_H / ATLAS_H]);
  ff.setTextureMatrix(textureMatrix);
}

gl.bindVertexArray(glyphQuadVao);
for (let i = 0; i < text.length; i++) {
  selectGlyph(text.charCodeAt(i));
  mat4.fromTranslation(model, [x + i * (CELL_W + LETTER_SPACING), y, 0]);
  mat4.scale(model, model, [CELL_W, CELL_H, 1]);
  ff.setModelMatrix(model);
  ff.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}
ff.setTextureMatrix(mat3.create()); // the texture matrix persists. Reset it before other textured draws.
```

This method needs no dynamic buffers, but it makes one draw call per character. Use it for short labels. Use the batched mesh from steps 4 and 5 for long text or text that changes each frame.

#### Text in the 3D scene

For a label in the world, keep the perspective projection and the depth test. Make these changes:

1. Draw the text after all opaque objects.
2. Call `gl.depthMask(false)` before the text draw. FF has no alpha test, so transparent texels write depth and hide objects that you draw later.
3. Call `gl.depthMask(true)` after the text draw.
4. Keep fog on if the label must fade with the scene.

#### Sprite font checklist

| Symptom | Cause | Fix |
|---|---|---|
| Glyphs are upside down, or show the wrong row | The `t` math does not match `UNPACK_FLIP_Y_WEBGL` | Use the `t` formula for your flip setting (step 3) |
| Thin lines at the glyph edges | `LINEAR` filtering or mipmaps sample the neighbor cells | Use `NEAREST`, add padding, or move the UVs 0.5 texel inward |
| Black boxes behind the glyphs | Blending is off | `gl.enable(gl.BLEND)` with `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` |
| White or gray boxes, or grid lines, around the glyphs | The atlas background is opaque | Make the background and grid lines transparent (step 1) |
| Text is always black, whatever `setColor` gets | The atlas has black glyphs | Make the glyphs white (step 1) |
| Glyphs are cut, or show part of the next glyph | `CELL_W`, `CELL_H`, `PITCH_X`, `PITCH_Y` or `BORDER` does not match the atlas | Measure the atlas in an image editor and correct the values |
| Glyphs touch each other | Some glyphs fill the full cell width | Set `LETTER_SPACING` to 1 or more |
| Glyph edges look blurred or uneven | The scale is not an integer, or the text position is not on whole pixels | Use an integer `scale` and round `x` and `y` |
| Text is not visible | The depth test hides the quads, or face culling removes clockwise quads | Disable `DEPTH_TEST` for the HUD pass. Check the vertex order, or disable `CULL_FACE` |
| Text is dark or changes with the light | `LIGHTING` is on | `ff.disable(LIGHTING)` for the HUD pass |
| Text takes the fog color | `FOG` is on | `ff.disable(FOG)` for the HUD pass |
| Other textures show only one glyph | The texture matrix from the text pass persists | Call `ff.setTextureMatrix(mat3.create())` after the text pass |
| Text color does not change | The VAO enables `ATTRIB.COLOR` | Remove the color array, or write the color into each vertex |

### Dirty state and flush

FF stores state in JavaScript. It uploads state to the GPU only when needed.

1. A setter for a matrix, light, material, fog, capability or global ambient stores the value. The setter marks that state group dirty. The setter does not call WebGL.
2. `flush()` binds the FF program with `gl.useProgram`. It uploads each dirty group as a uniform. Then it clears the dirty marks.
3. `drawArrays` and `drawElements` call `flush()` before the draw call.
4. `setColor` and `setNormal` call WebGL right away. They write the generic values of `ATTRIB.COLOR` and `ATTRIB.NORMAL`.

Call `flush()` in these cases:

- You issue raw WebGL draw calls that use the FF program.
- You switch to another program, then return to FF. `flush()` calls `gl.useProgram` again.

Setters copy their input. Changing your `mat4` after the call does not change FF state. Call the setter again to update the state.

## Default state

FF starts with these values. They match the OpenGL 2 defaults where the feature exists in v1.2.

| State | Default |
|---|---|
| `LIGHTING` capability | Off (`false`) |
| `COLOR_MATERIAL` capability | Off (`false`) |
| `TEXTURE_2D` capability | Off (`false`) |
| `FOG` capability | Off (`false`) |
| Projection matrix | Identity |
| View matrix | Identity |
| Model matrix | Identity |
| Normal matrix (`mat3`) | Identity |
| Texture matrix (`mat3`) | Identity |
| Eye position | `(0, 0, 0)` |
| Global ambient | `(0.2, 0.2, 0.2, 1)` |
| Light `i` enabled (`i` = 0 to 7) | Off (`false`) |
| Light `i` position | `(0, 0, 1, 0)` |
| Light `i` ambient | `(0, 0, 0, 1)` |
| Light 0 diffuse and specular | `(1, 1, 1, 1)` |
| Light 1 to 7 diffuse and specular | `(0, 0, 0, 1)` |
| Light `i` attenuation (constant, linear, quadratic) | `1`, `0`, `0` |
| Light `i` spot direction | `(0, 0, -1)` |
| Light `i` spot cutoff | `Math.PI` (not a spot) |
| Light `i` spot exponent | `0` |
| Material ambient | `(0.2, 0.2, 0.2, 1)` |
| Material diffuse | `(0.8, 0.8, 0.8, 1)` |
| Material specular | `(0, 0, 0, 1)` |
| Material shininess | `0` |
| Material emissive | `(0, 0, 0, 1)` |
| Fog color | `(0, 0, 0, 1)` |
| Fog start | `0` |
| Fog end | `1` |
| Current color (`ATTRIB.COLOR`) | `(1, 1, 1, 1)` |
| Current normal (`ATTRIB.NORMAL`) | `(0, 0, 1)` |

## API reference

Each group lists its members in alphabetical order.

### Creation

#### createFixedFunction

```ts
function createFixedFunction(gl: WebGL2RenderingContext, options?: FFOptions): FixedFunction
```

Compiles and links the FF shaders. Creates the FF state with the defaults in [Default state](#default-state). Sets the current color to `(1, 1, 1, 1)` and the current normal to `(0, 0, 1)`.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `gl` | `WebGL2RenderingContext` | The WebGL2 context. |
| `options` | `FFOptions` | Optional. Default `{}`. |

**Throws**

- `Error` if the vertex or fragment shader fails to compile. The message starts with `FF: shader compile failed:` and includes the shader info log.
- `Error` if the program fails to link. The message starts with `FF: program link failed:` and includes the program info log.

**Debug warnings**: None.

**GL2 equivalent**: None. The OpenGL 2 fixed-function path has no program object; the driver supplies the pipeline. FF creates a program for you.

### Capabilities

#### disable

```ts
disable(cap: Capability): void
```

Turns off a capability. Marks the switches dirty.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `cap` | `Capability` | `LIGHTING`, `COLOR_MATERIAL`, `TEXTURE_2D` or `FOG`. |

**Throws**

- `Error` if `cap` is any other value. The message is `FF: unknown capability "<name>".`

**Debug warnings**: None.

**GL2 equivalent**: `glDisable`.

#### enable

```ts
enable(cap: Capability): void
```

Turns on a capability. Marks the switches dirty.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `cap` | `Capability` | `LIGHTING`, `COLOR_MATERIAL`, `TEXTURE_2D` or `FOG`. |

**Throws**

- `Error` if `cap` is any other value. The same message as `disable`.

**Debug warnings**: None.

**GL2 equivalent**: `glEnable`.

#### isEnabled

```ts
isEnabled(cap: Capability): boolean
```

Returns `true` if the capability is on.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `cap` | `Capability` | `LIGHTING`, `COLOR_MATERIAL`, `TEXTURE_2D` or `FOG`. |

**Returns**: `boolean`.

**Throws**

- `Error` if `cap` is any other value. The same message as `disable`.

**Debug warnings**: None.

**GL2 equivalent**: `glIsEnabled`.

### Current vertex attributes

#### setColor

```ts
setColor(color: Color): void
```

Sets the current color. This is the generic value of `ATTRIB.COLOR`. The value applies when the `ATTRIB.COLOR` array is disabled. Alpha defaults to `1` when you pass RGB.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `color` | `Color` | RGB or RGBA. |

**Throws**: None.

**Debug warnings**: None.

**GL2 equivalent**: `glColor4f`.

#### setNormal

```ts
setNormal(normal: ReadonlyVec3): void
```

Sets the current normal. This is the generic value of `ATTRIB.NORMAL`. The value applies when the `ATTRIB.NORMAL` array is disabled. The vertex shader normalizes the transformed normal. Pass a non-zero vector.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `normal` | `ReadonlyVec3` | The normal vector in object space. |

**Throws**: None.

**Debug warnings**: None.

**GL2 equivalent**: `glNormal3f`.

### Transformation matrices

#### setModelMatrix

```ts
setModelMatrix(m: ReadonlyMat4): void
```

Sets the model matrix. Column-major, as gl-matrix stores it. Does not update the normal matrix. Call `setNormalMatrix` after this call when lighting is on.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `m` | `ReadonlyMat4` | The model matrix. |

**Throws**: None.

**Debug warnings**

- `[FF] model matrix contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).`
- `[FF] Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (lecture 2B/9A).` The warning appears at draw time, only when lighting is on.

**GL2 equivalent**: `glLoadMatrixf` with `GL_MODELVIEW`. FF stores the model part of the modelview matrix.

#### setNormalMatrix

```ts
setNormalMatrix(m: ReadonlyMat3): void
```

Sets the normal matrix. Use the inverse transpose of the upper 3x3 of the model matrix. In gl-matrix, use `mat3.normalFromMat4`.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `m` | `ReadonlyMat3` | The normal matrix. |

**Throws**: None.

**Debug warnings**

- `[FF] normal matrix contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).`

**GL2 equivalent**: None. OpenGL 2 computes the normal matrix from the modelview matrix.

#### setProjectionMatrix

```ts
setProjectionMatrix(m: ReadonlyMat4): void
```

Sets the projection matrix. Column-major, as gl-matrix stores it. FF accepts any projection: perspective (`mat4.perspective`) or orthographic (`mat4.ortho`). For 2D drawing in pixel coordinates, see [Sprite font draw](#sprite-font-draw).

**Parameters**

| Name | Type | Description |
|---|---|---|
| `m` | `ReadonlyMat4` | The projection matrix. |

**Throws**: None.

**Debug warnings**

- `[FF] projection matrix contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).`

**GL2 equivalent**: `glLoadMatrixf` with `GL_PROJECTION`.

#### setViewMatrix

```ts
setViewMatrix(m: ReadonlyMat4): void
```

Sets the view matrix. Column-major, as gl-matrix stores it. Computes the eye position from the inverse of the view matrix. If the matrix is not invertible, the eye position keeps its previous value.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `m` | `ReadonlyMat4` | The view matrix. |

**Throws**: None.

**Debug warnings**

- `[FF] view matrix contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).`
- `[FF] View matrix is not invertible; the eye position was not updated.` This warning requires `debug: true`.

**GL2 equivalent**: `glLoadMatrixf` with `GL_MODELVIEW`. FF stores the view part of the modelview matrix.

### Lighting

#### disableLight

```ts
disableLight(index: number): void
```

Turns off a light. Marks the lights dirty.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `index` | `number` | The light index, from `0` to `7`. Must be an integer in `[0, maxLights)`. |

**Throws**

- `RangeError` if `index` is not an integer, or is outside `[0, maxLights)`. The message is `FF: light index N is outside [0, 8). FF v1.2 has 8 lights (indices 0–7).`

**Debug warnings**: None.

**GL2 equivalent**: `glDisable` with `GL_LIGHT0` to `GL_LIGHT7`.

#### enableLight

```ts
enableLight(index: number): void
```

Turns on a light. Marks the lights dirty. A light has no effect until you enable it.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `index` | `number` | The light index, from `0` to `7`. Must be an integer in `[0, maxLights)`. |

**Throws**

- `RangeError` if `index` is not an integer, or is outside `[0, maxLights)`. The same message as `disableLight`.

**Debug warnings**: None.

**GL2 equivalent**: `glEnable` with `GL_LIGHT0` to `GL_LIGHT7`.

#### setGlobalAmbient

```ts
setGlobalAmbient(color: Color): void
```

Sets the global ambient light color. Default `(0.2, 0.2, 0.2, 1)`.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `color` | `Color` | RGB or RGBA. |

**Throws**: None.

**Debug warnings**: None.

**GL2 equivalent**: `glLightModelfv` with `GL_LIGHT_MODEL_AMBIENT`.

#### setLight

```ts
setLight(index: number, params: LightParams): void
```

Sets the properties of a light. Only the fields you pass change. Does not enable the light. Call `enableLight` to turn the light on. If any field is invalid, the call throws and the light keeps its state.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `index` | `number` | The light index, from `0` to `7`. Must be an integer in `[0, maxLights)`. |
| `params` | `LightParams` | The light fields to set. |

`params` fields:

- `position`: `ReadonlyVec4`. World space. `w = 0` makes the light directional, and `xyz` points toward the light. Any other `w` makes the light positional, and `xyz` is its position. Use `w = 1` for positional lights. Default `(0, 0, 1, 0)`.
- `ambient`: `Color`. Default `(0, 0, 0, 1)`.
- `diffuse`: `Color`. Default `(1, 1, 1, 1)` for light 0. Default `(0, 0, 0, 1)` for lights 1 to 7.
- `specular`: `Color`. Same defaults as `diffuse`.
- `constantAttenuation`: `number`, at least `0`. Default `1`. Positional lights only.
- `linearAttenuation`: `number`, at least `0`. Default `0`. Positional lights only.
- `quadraticAttenuation`: `number`, at least `0`. Default `0`. Positional lights only.
- `spotDirection`: `ReadonlyVec3`. World space, not zero-length. FF normalizes it. Default `(0, 0, -1)`. Positional lights only.
- `spotCutoff`: `number`, in radians. In `[0, Math.PI / 2]`, or `Math.PI` for a light that is not a spot. Default `Math.PI`. Positional lights only.
- `spotExponent`: `number`, in `[0, 128]`. Default `0`. Has no effect when `spotCutoff` is `Math.PI`. Positional lights only.

**Throws**

- `RangeError` if `index` is not an integer, or is outside `[0, maxLights)`. The same message as `disableLight`.
- `RangeError` if `constantAttenuation`, `linearAttenuation` or `quadraticAttenuation` is negative or not finite. The message is `FF: <name> <value> must be finite and at least 0.`
- `RangeError` if `spotCutoff` is outside `[0, Math.PI / 2]` and is not `Math.PI`. The message is `FF: spotCutoff <value> is outside [0, π/2]. Use Math.PI for a light that is not a spot.`
- `RangeError` if `spotExponent` is outside `[0, 128]`. The message is `FF: spotExponent <value> is outside [0, 128].`
- `RangeError` if `spotDirection` has zero length or is not finite. The message is `FF: spotDirection [x, y, z] must be finite and not zero-length.`

**Debug warnings**: None.

**GL2 equivalent**: `glLightfv` with `GL_LIGHT0` to `GL_LIGHT7` and `GL_POSITION`, `GL_AMBIENT`, `GL_DIFFUSE`, `GL_SPECULAR`, `GL_CONSTANT_ATTENUATION`, `GL_LINEAR_ATTENUATION`, `GL_QUADRATIC_ATTENUATION`, `GL_SPOT_DIRECTION`, `GL_SPOT_CUTOFF` or `GL_SPOT_EXPONENT`.

### Material

#### setMaterial

```ts
setMaterial(params: MaterialParams): void
```

Sets the material properties. Only the fields you pass change. Marks the material dirty. When `COLOR_MATERIAL` is on, the vertex color replaces the material ambient and diffuse values in the lighting math. See [Lighting model](#lighting-model).

**Parameters**

| Name | Type | Description |
|---|---|---|
| `params` | `MaterialParams` | The material fields to set. |

`params` fields:

- `ambient`: `Color`. Default `(0.2, 0.2, 0.2, 1)`.
- `diffuse`: `Color`. Default `(0.8, 0.8, 0.8, 1)`. The alpha value of the lit output comes from diffuse, unless `COLOR_MATERIAL` is on (then it comes from the vertex color).
- `specular`: `Color`. Default `(0, 0, 0, 1)`.
- `shininess`: `number` in `[0, 128]`. Default `0`.
- `emissive`: `Color`. Default `(0, 0, 0, 1)`. The color is added to the lit output. Lights do not change it.

**Throws**

- `RangeError` if `shininess` is outside `[0, 128]`, or is `NaN`. The message is `FF: shininess <value> is outside [0, 128].`

**Debug warnings**: None.

**GL2 equivalent**: `glMaterialfv` with `GL_FRONT_AND_BACK` and `GL_AMBIENT`, `GL_DIFFUSE`, `GL_SPECULAR`, `GL_SHININESS` or `GL_EMISSION`.

### Texturing

#### setTextureMatrix

```ts
setTextureMatrix(m: ReadonlyMat3): void
```

Sets the texture matrix. Uploads on the next flush. The default is the identity. FF applies it to the UV coordinates as `(u', v', 1) = T (u, v, 1)`. The matrix affects texturing only. The matrix persists for all later draws until you set it again.

To select a sub-rectangle of an atlas, scale the UVs, then translate them: `T = translate(s0, t0) * scale(width, height)`, in texture units. See [Sprite font draw](#alternative-one-quad-and-the-texture-matrix).

**Parameters**

| Name | Type | Description |
|---|---|---|
| `m` | `ReadonlyMat3` | Column-major 3x3 matrix. |

**Throws**: None.

**Debug warnings**

- `[FF] texture matrix contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).`

**GL2 equivalent**: `glMatrixMode(GL_TEXTURE)` with `glLoadMatrixf`. FF takes a 3x3 affine matrix, not a 4x4.

### Fog

#### setFog

```ts
setFog(params: FogParams): void
```

Sets the fog parameters. Only the fields you pass change. Uploads on the next flush. Fog has no effect until you call `enable(FOG)`. If the resulting state is invalid, the call throws and the fog keeps its state.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `params` | `FogParams` | The fog fields to set. |

`params` fields:

- `color`: `Color`. FF uses the RGB values. Default `(0, 0, 0, 1)`.
- `start`: `number`. Eye-space distance where fog starts. Vertices closer than this have no fog. Default `0`.
- `end`: `number`. Eye-space distance where fog is complete. Vertices at or beyond this distance have the fog color. Default `1`.

**Throws**

- `RangeError` if the resulting `end` is not greater than the resulting `start`. The message is `FF: fog end <end> must be greater than fog start <start>.`

**Debug warnings**: None.

**GL2 equivalent**: `glFogfv` with `GL_FOG_COLOR`, `GL_FOG_START` and `GL_FOG_END`. FF uses linear fog only.

### Drawing

#### drawArrays

```ts
drawArrays(mode: GLenum, first: number, count: number): void
```

Calls `flush()`, then `gl.drawArrays`. Draws with the FF program and the bound VAO. FF passes `mode` to WebGL without a check. WebGL2 accepts `POINTS`, `LINES`, `LINE_STRIP`, `LINE_LOOP`, `TRIANGLES`, `TRIANGLE_STRIP` and `TRIANGLE_FAN`. It has no `QUADS`: draw each quad as two triangles.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `mode` | `GLenum` | The primitive type, for example `gl.TRIANGLES`. |
| `first` | `number` | The first vertex index. |
| `count` | `number` | The number of vertices. |

**Throws**: None from FF. WebGL reports invalid calls as error codes. In debug mode, FF reports them as a warning. See [Debug warnings](#debug-warnings).

**Debug warnings**

- `[FF] No position data bound: did you bind your VAO?`
- `[FF] Lighting is on but every light is disabled; only global ambient and emissive will show.`
- `[FF] Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (lecture 2B/9A).`
- `[FF] Vertex colors are ignored under lighting unless COLOR_MATERIAL is enabled.`
- `[FF] Texturing is on but nothing is bound to TEXTURE0 (lecture 6A).`
- `[FF] GL error <NAME> after drawArrays.`

**GL2 equivalent**: `glDrawArrays`.

#### drawElements

```ts
drawElements(mode: GLenum, count: number, type: GLenum, offset: number): void
```

Calls `flush()`, then `gl.drawElements`. Draws with the FF program and the bound VAO. The VAO must have an element array buffer bound.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `mode` | `GLenum` | The primitive type, for example `gl.TRIANGLES`. |
| `count` | `number` | The number of indices. |
| `type` | `GLenum` | The index type, for example `gl.UNSIGNED_SHORT`. |
| `offset` | `number` | The byte offset in the element array buffer. |

**Throws**: None from FF. WebGL reports invalid calls as error codes. In debug mode, FF reports them as a warning. See [Debug warnings](#debug-warnings).

**Debug warnings**: The same list as `drawArrays`, with `after drawElements` in the GL error message.

- `[FF] GL error <NAME> after drawElements.`

**GL2 equivalent**: `glDrawElements`.

#### flush

```ts
flush(): void
```

Binds the FF program with `gl.useProgram`. Uploads each dirty state group as uniforms. Clears the dirty marks. Call it before raw WebGL draw calls that use the FF program. See [Dirty state and flush](#dirty-state-and-flush).

**Parameters**: None.

**Throws**: None.

**Debug warnings**: None.

**GL2 equivalent**: None. OpenGL 2 applies state at each call.

### Introspection

#### getState

```ts
getState(): Readonly<FFStateSnapshot>
```

Returns a snapshot of the FF state. The snapshot is deep-frozen. Its arrays are plain JavaScript arrays, not typed arrays. Use it for debugging and tests. The snapshot does not update when the state changes.

**Parameters**: None.

**Returns**: `Readonly<FFStateSnapshot>`. See [FFStateSnapshot](#ffstatesnapshot).

**Throws**: None.

**Debug warnings**: None.

**GL2 equivalent**: None. Use the `glGet*` functions in OpenGL 2.

### Instance properties

#### maxLights

```ts
readonly maxLights: number
```

The number of lights that FF supports. The value is `8` in v1.2. Light indices run from `0` to `maxLights - 1`.

**GL2 equivalent**: `GL_MAX_LIGHTS` (queried with `glGetIntegerv`).

#### program

```ts
readonly program: WebGLProgram
```

The linked FF program. Use it for raw WebGL calls. Call `flush()` before the raw draw call.

**GL2 equivalent**: None. The OpenGL 2 fixed-function path has no program object.

#### version

```ts
readonly version: string
```

The FF version string, for example `'1.2.0'`. Same value as `FF_VERSION`.

**GL2 equivalent**: None.

### Constants

#### ATTRIB

```ts
const ATTRIB: { readonly POSITION: 0; readonly NORMAL: 1; readonly COLOR: 2; readonly UV: 3 }
```

Fixed attribute locations. Use them as the index argument of `gl.enableVertexAttribArray` and `gl.vertexAttribPointer`.

| Member | Value | Data |
|---|---|---|
| `POSITION` | `0` | `vec3` position. |
| `NORMAL` | `1` | `vec3` normal. |
| `COLOR` | `2` | `vec4` color. |
| `UV` | `3` | `vec2` texture coordinates, `s t`. |

**GL2 equivalent**: `glVertexPointer` (`POSITION`), `glNormalPointer` (`NORMAL`), `glColorPointer` (`COLOR`), `glTexCoordPointer` (`UV`).

#### COLOR_MATERIAL

```ts
const COLOR_MATERIAL = 'colorMaterial'
```

The capability name for color material. When on with lighting, the vertex color replaces the material ambient and diffuse values in the lighting math. The alpha comes from the vertex color.

**GL2 equivalent**: `GL_COLOR_MATERIAL`.

#### FF_VERSION

```ts
const FF_VERSION = '1.2.0'
```

The FF version string.

**GL2 equivalent**: None.

#### FOG

```ts
const FOG = 'fog'
```

The capability name for fog. When on, FF blends the final color toward the fog color with linear fog. Set the fog parameters with `setFog`.

**GL2 equivalent**: `GL_FOG`.

#### LIGHTING

```ts
const LIGHTING = 'lighting'
```

The capability name for lighting. When off, FF outputs the vertex color.

**GL2 equivalent**: `GL_LIGHTING`.

#### TEXTURE_2D

```ts
const TEXTURE_2D = 'texture2D'
```

The capability name for 2D texturing. When on, FF samples the texture bound to `TEXTURE_UNIT` and modulates the color with it. FF does not bind textures.

**GL2 equivalent**: `GL_TEXTURE_2D`.

#### TEXTURE_UNIT

```ts
const TEXTURE_UNIT = 0
```

The texture unit that FF samples. FF sets its sampler to this unit once, at creation. Bind your texture to `gl.TEXTURE0 + TEXTURE_UNIT`.

**GL2 equivalent**: `glActiveTexture(GL_TEXTURE0)`.

### Types

#### Capability

```ts
type Capability = typeof LIGHTING | typeof COLOR_MATERIAL | typeof TEXTURE_2D | typeof FOG
```

The names accepted by `enable`, `disable` and `isEnabled`: `'lighting'`, `'colorMaterial'`, `'texture2D'` and `'fog'`.

#### Color

```ts
type Color = RGB | RGBA
```

An RGB or RGBA color. Alpha defaults to `1` when omitted.

#### FFOptions

```ts
interface FFOptions {
  debug?: boolean; // default: false
}
```

Options for `createFixedFunction`.

| Field | Type | Default | Description |
|---|---|---|---|
| `debug` | `boolean` | `false` | Turns on usage checks. Each warning prints once per instance. |

#### FFStateSnapshot

```ts
interface FFStateSnapshot {
  readonly version: string;
  readonly capabilities: Readonly<Record<Capability, boolean>>;
  readonly matrices: Readonly<Record<'projection' | 'view' | 'model' | 'normal' | 'texture', readonly number[]>>;
  readonly eyePosition: readonly number[];
  readonly globalAmbient: readonly number[];
  readonly lights: readonly Readonly<{
    enabled: boolean;
    position: readonly number[];
    ambient: readonly number[];
    diffuse: readonly number[];
    specular: readonly number[];
    attenuation: readonly number[]; // constant, linear, quadratic
    spotDirection: readonly number[];
    spotCutoff: number;
    spotExponent: number;
  }>[];
  readonly material: Readonly<{
    ambient: readonly number[];
    diffuse: readonly number[];
    specular: readonly number[];
    shininess: number;
    emissive: readonly number[];
  }>;
  readonly fog: Readonly<{
    color: readonly number[];
    start: number;
    end: number;
  }>;
}
```

The return type of `getState`. Matrices are column-major arrays. Projection, view and model have 16 numbers each. Normal and texture have 9 numbers each. The `lights` array has `maxLights` entries.

#### FixedFunction

```ts
interface FixedFunction { /* members listed in the API reference */ }
```

The object returned by `createFixedFunction`. Its members are listed in the groups above: `version`, `maxLights`, `program`, the capability functions, the attribute functions, the matrix functions, the lighting functions, `setMaterial`, `setTextureMatrix`, `setFog`, the drawing functions and `getState`.

#### FogParams

```ts
interface FogParams {
  color?: Color;  // default (0, 0, 0, 1)
  start?: number; // eye-space distance, default 0
  end?: number;   // eye-space distance, default 1
}
```

The fields accepted by `setFog`. See `setFog` for the defaults and rules.

#### LightParams

```ts
interface LightParams {
  position?: ReadonlyVec4;        // world space. w = 0: directional. Other w: positional
  ambient?: Color;
  diffuse?: Color;
  specular?: Color;
  constantAttenuation?: number;   // at least 0
  linearAttenuation?: number;     // at least 0
  quadraticAttenuation?: number;  // at least 0
  spotDirection?: ReadonlyVec3;   // world space, not zero-length
  spotCutoff?: number;            // radians, [0, Math.PI / 2], or Math.PI
  spotExponent?: number;          // [0, 128]
}
```

The fields accepted by `setLight`. See `setLight` for the defaults and rules.

#### MaterialParams

```ts
interface MaterialParams {
  ambient?: Color;
  diffuse?: Color;
  specular?: Color;
  shininess?: number; // [0, 128]
  emissive?: Color;
}
```

The fields accepted by `setMaterial`. See `setMaterial` for the defaults and rules.

#### RGB

```ts
type RGB = readonly [number, number, number];
```

An RGB color. Components are usually in `[0, 1]`. FF sets alpha to `1` when it converts the color to RGBA.

#### RGBA

```ts
type RGBA = readonly [number, number, number, number];
```

An RGBA color.

## Lighting model

FF computes the lighting per vertex in world space. The vertex shader computes the primary color and the specular color. The fragment shader applies the texture, adds the specular color and applies fog. The shader files contain the exact code.

Names in the equations match the shader variables. `.` is the dot product. `*` multiplies RGB components one by one, except where a scalar is shown. Vectors are unit length unless stated.

- `n`: the normal, `normalize(u_normalMatrix * a_normal)`.
- `v`: the unit vector from the vertex toward the eye.
- `l`: the unit vector from the vertex toward the light.
- `p`: the vertex position in world space.
- `r`: the reflection vector, `2(n . l)n - l`.

### Vertex stage

The vertex shader applies these equations to each vertex.

1. Base colors. `COLOR_MATERIAL` selects the vertex color or the material. Emission always comes from the material.

```text
ka = COLOR_MATERIAL ? vertex color : material ambient
kd = COLOR_MATERIAL ? vertex color : material diffuse
ke = material emissive
```

2. Light terms. Each enabled light i adds these terms. Lights 0 to 7 use the same equations.

```text
Directional (w = 0):  l = normalize(position.xyz)
                      att = 1
                      spot = 1

Positional (w != 0):  d = length(position.xyz - p)
                      l = (position.xyz - p) / d
                      att = 1 / (constantAttenuation + linearAttenuation * d + quadraticAttenuation * d * d)
                      spot = 1, when spotCutoff = Math.PI
                      spot = 0, when (-l) . spotDirection < cos(spotCutoff)
                      spot = 1, when spotExponent = 0
                      spot = max((-l) . spotDirection, 0) ^ spotExponent, otherwise
```

3. Phong specular factor. FF computes `f` for each light.

```text
f = 0                              when n . l <= 0
f = 1                              when shininess = 0
f = pow(max(r . v, 0), shininess)  otherwise
```

4. Colors. The primary color includes emission and global ambient. The specular color has no ambient or emissive term.

```text
primary  = ke + ka * globalAmbient
           + sum over enabled lights i of att * spot * (ka * ambient_i + kd * diffuse_i * max(n . l, 0))

specular = sum over enabled lights i of att * spot * material specular * specular_i * f
```

5. Clamp and alpha. FF clamps the RGB of `primary` to `[0, 1]`. The alpha of `primary` is `kd` alpha. FF does not clamp `specular`.

For an unlit draw, `primary` is the vertex color and `specular` is `(0, 0, 0)`.

The vertex shader also computes the texture coordinates and the fog factor.

```text
uv = (textureMatrix * (a_uv, 1)).xy

z = length of the vertex position in eye space
fogFactor = clamp((fogEnd - z) / (fogEnd - fogStart), 0, 1), when FOG is on
fogFactor = 1, when FOG is off
```

The GPU interpolates `uv` and `fogFactor` across the primitive.

### Fragment stage

The fragment shader applies these equations to each fragment.

```text
t = texture(unit 0, uv), when TEXTURE_2D is on
t = (1, 1, 1, 1),        when TEXTURE_2D is off

color.rgb = t.rgb * primary.rgb + specular
color.a   = t.a * primary.a
color.rgb = fogColor.rgb * (1 - fogFactor) + color.rgb * fogFactor
```

Texture alpha multiplies the output alpha. The specular color is added after texturing, so the texture does not change it. Fog blends the final RGB only. Fog does not change alpha.

## Debug warnings

Every warning requires `debug: true` in `createFixedFunction`. FF prints each warning with `console.warn`, once per FF instance and warning kind. GL errors print once per error name and draw function. Each message starts with `[FF] `.

| Condition | Message |
|---|---|
| A matrix passed to `setProjectionMatrix`, `setViewMatrix`, `setModelMatrix`, `setNormalMatrix` or `setTextureMatrix` contains `NaN` or `Infinity` | `[FF] <name> contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).` `<name>` is `projection matrix`, `view matrix`, `model matrix`, `normal matrix` or `texture matrix`. |
| No position array is enabled at draw time | `[FF] No position data bound: did you bind your VAO?` |
| Lighting is on and every light is disabled | `[FF] Lighting is on but every light is disabled; only global ambient and emissive will show.` |
| Lighting is on and the model matrix changed without `setNormalMatrix` | `[FF] Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (lecture 2B/9A).` |
| Lighting is on, `COLOR_MATERIAL` is off, and the color array is enabled | `[FF] Vertex colors are ignored under lighting unless COLOR_MATERIAL is enabled.` |
| Texturing is on and nothing is bound to `TEXTURE_UNIT` (unit 0) | `[FF] Texturing is on but nothing is bound to TEXTURE0 (lecture 6A).` |
| A WebGL error is raised after a draw call | `[FF] GL error <NAME> after <drawArrays or drawElements>.` `<NAME>` is `INVALID_ENUM`, `INVALID_VALUE`, `INVALID_OPERATION`, `OUT_OF_MEMORY` or `CONTEXT_LOST_WEBGL`. Other codes print as a number. |
| The view matrix is not invertible | `[FF] View matrix is not invertible; the eye position was not updated.` This warning is debug-only. It prints when `debug` is `true`. |

## Errors

FF throws these errors. The `debug` option does not change them.

| Condition | Error type | Source |
|---|---|---|
| A vertex or fragment shader fails to compile. The message starts with `FF: shader compile failed:`. | `Error` | `createFixedFunction` |
| The program fails to link. The message starts with `FF: program link failed:`. | `Error` | `createFixedFunction` |
| `enable`, `disable` or `isEnabled` gets a name that is not `'lighting'`, `'colorMaterial'`, `'texture2D'` or `'fog'`. The message is `FF: unknown capability "<name>".` | `Error` | `enable`, `disable`, `isEnabled` |
| A light index is not an integer, or is outside `[0, maxLights)`. The message is `FF: light index N is outside [0, 8). FF v1.2 has 8 lights (indices 0–7).` | `RangeError` | `setLight`, `enableLight`, `disableLight` |
| `setLight` gets an attenuation field that is negative or not finite. | `RangeError` | `setLight` |
| `setLight` gets a `spotCutoff` outside `[0, Math.PI / 2]` that is not `Math.PI`. | `RangeError` | `setLight` |
| `setLight` gets a `spotExponent` outside `[0, 128]`. | `RangeError` | `setLight` |
| `setLight` gets a `spotDirection` with zero length or a value that is not finite. | `RangeError` | `setLight` |
| `setMaterial` gets a `shininess` outside `[0, 128]`, or `NaN`. | `RangeError` | `setMaterial` |
| `setFog` gets a resulting `end` that is not greater than the resulting `start`. | `RangeError` | `setFog` |

## Version roadmap

| Version | Status | Features |
|---|---|---|
| v1.0.0 | Shipped in week 2 | Unlit and lit drawing. One directional light. One material. Per-vertex Phong lighting in world space. Matrix state. Debug warnings. |
| v1.2.0 | Current, week 9 | Texturing on unit 0 with a texture matrix and texture alpha. Emissive material color. Up to eight directional, point and spot lights, with attenuation. Linear fog. `ATTRIB.UV` vertex data. |

The texturing and emissive features were planned for v1.1. They ship in v1.2. There is no separate v1.1 release.

## Upgrading from v1.0

v1.0 code runs unchanged on v1.2. Replace the whole `src/vendor/ff/` folder with the v1.2 files. Do not replace single files.

These changes affect v1.0 code:

- Calls that threw in v1.0 now work. These are `emissive` in `setMaterial`, positional and spot fields in `setLight`, and the `'texture2D'` and `'fog'` capabilities.
- `maxLights` is `8`, not `1`. Light 0 behaves as before.
- The view matrix warning prints only in debug mode.
