# FixedFunction (FF) usage guide and API reference

FixedFunction (FF) version 1.0.0 emulates the OpenGL 2 fixed-function pipeline on WebGL2. FF creates and owns the shader program. You set state with function calls. FF uploads that state as uniforms when you draw.

The shaders are in [`ff.vert.glsl`](./ff.vert.glsl) and [`ff.frag.glsl`](./ff.frag.glsl). Read them to see the exact lighting math.

## Table of contents

- [Overview](#overview)
- [Initialization](#initialization)
- [Basic usage](#basic-usage)
  - [Unlit draw](#unlit-draw)
  - [Lit draw](#lit-draw)
  - [Dirty state and flush](#dirty-state-and-flush)
- [Default state](#default-state)
- [API reference](#api-reference)
  - [Creation](#creation)
  - [Capabilities](#capabilities)
  - [Current vertex attributes](#current-vertex-attributes)
  - [Transformation matrices](#transformation-matrices)
  - [Lighting](#lighting)
  - [Material](#material)
  - [Drawing](#drawing)
  - [Introspection](#introspection)
  - [Instance properties](#instance-properties)
  - [Constants](#constants)
  - [Types](#types)
- [Lighting model](#lighting-model)
- [Debug warnings](#debug-warnings)
- [Errors](#errors)
- [Version roadmap](#version-roadmap)

## Overview

FF v1.0.0 supports:

- Unlit drawing with per-vertex color.
- Matrix transforms: projection, view and model, plus a normal matrix.
- One directional light.
- One material, with ambient, diffuse, specular and shininess.
- Per-vertex (Gouraud) lighting in world space.
- Phong specular reflection.

FF v1.0.0 does not support:

- Textures. These arrive in v1.1.
- Emissive material color. This arrives in v1.1.
- Fog. This arrives in v1.2.
- Positional and spot lights, and attenuation. These arrive in v1.2.
- More than one light. `maxLights` is 1.
- The Blinn half-vector. FF uses the Phong reflection vector.

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
| `ATTRIB.UV` | 3 | Reserved. Sampled from v1.1. | None in v1.0 |

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

### Dirty state and flush

FF stores state in JavaScript. It uploads state to the GPU only when needed.

1. A matrix, light, material, capability or global ambient setter stores the value. The setter marks that state group dirty. The setter does not call WebGL.
2. `flush()` binds the FF program with `gl.useProgram`. It uploads each dirty group as a uniform. Then it clears the dirty marks.
3. `drawArrays` and `drawElements` call `flush()` before the draw call.
4. `setColor` and `setNormal` call WebGL right away. They write the generic values of `ATTRIB.COLOR` and `ATTRIB.NORMAL`.

Call `flush()` in these cases:

- You issue raw WebGL draw calls that use the FF program.
- You switch to another program, then return to FF. `flush()` calls `gl.useProgram` again.

Setters copy their input. Changing your `mat4` after the call does not change FF state. Call the setter again to update the state.

## Default state

FF starts with these values. They match the OpenGL 2 defaults where the feature exists in v1.0.

| State | Default |
|---|---|
| `LIGHTING` capability | Off (`false`) |
| `COLOR_MATERIAL` capability | Off (`false`) |
| Projection matrix | Identity |
| View matrix | Identity |
| Model matrix | Identity |
| Normal matrix (`mat3`) | Identity |
| Eye position | `(0, 0, 0)` |
| Global ambient | `(0.2, 0.2, 0.2, 1)` |
| Light 0 enabled | Off (`false`) |
| Light 0 position | `(0, 0, 1, 0)` |
| Light 0 ambient | `(0, 0, 0, 1)` |
| Light 0 diffuse | `(1, 1, 1, 1)` |
| Light 0 specular | `(1, 1, 1, 1)` |
| Material ambient | `(0.2, 0.2, 0.2, 1)` |
| Material diffuse | `(0.8, 0.8, 0.8, 1)` |
| Material specular | `(0, 0, 0, 1)` |
| Material shininess | `0` |
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
| `cap` | `Capability` | `LIGHTING` or `COLOR_MATERIAL`. |

**Throws**

- `Error` if `cap` is `'texture2D'`. Arrives in v1.1.
- `Error` if `cap` is `'fog'`. Arrives in v1.2.
- `Error` if `cap` is any other value.

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
| `cap` | `Capability` | `LIGHTING` or `COLOR_MATERIAL`. |

**Throws**

- `Error` if `cap` is `'texture2D'`. Arrives in v1.1.
- `Error` if `cap` is `'fog'`. Arrives in v1.2.
- `Error` if `cap` is any other value.

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
| `cap` | `Capability` | `LIGHTING` or `COLOR_MATERIAL`. |

**Returns**: `boolean`.

**Throws**

- `Error` if `cap` is `'texture2D'`, `'fog'`, or any other value that is not `LIGHTING` or `COLOR_MATERIAL`. The same rules as `enable`.

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
- `[FF] Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (...)`. The warning appears at draw time, only when lighting is on.

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

Sets the projection matrix. Column-major, as gl-matrix stores it.

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
- `[FF] View matrix is not invertible; the eye position was not updated.` This warning prints even when `debug` is `false`.

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
| `index` | `number` | The light index. Must be `0`, because `maxLights` is 1. |

**Throws**

- `RangeError` if `index` is not an integer, or is outside `[0, maxLights)`. The message has this form: `FF: light index N is outside [0, 1). FF v1.0 has 1 light.`

**Debug warnings**: None.

**GL2 equivalent**: `glDisable` with `GL_LIGHT0`.

#### enableLight

```ts
enableLight(index: number): void
```

Turns on a light. Marks the lights dirty. A light has no effect until you enable it.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `index` | `number` | The light index. Must be `0`, because `maxLights` is 1. |

**Throws**

- `RangeError` if `index` is not an integer, or is outside `[0, maxLights)`. The same message as `disableLight`.

**Debug warnings**: None.

**GL2 equivalent**: `glEnable` with `GL_LIGHT0`.

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

Sets the properties of a light. Only the fields you pass change. Does not enable the light. Call `enableLight` to turn the light on.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `index` | `number` | The light index. Must be `0`, because `maxLights` is 1. |
| `params` | `LightParams` | The light fields to set. |

`params` fields:

- `position`: `ReadonlyVec4`. World space. The `w` value must be `0`. The `xyz` values point toward the light. The shader normalizes them.
- `ambient`: `Color`. Default `(0, 0, 0, 1)`.
- `diffuse`: `Color`. Default `(1, 1, 1, 1)`.
- `specular`: `Color`. Default `(1, 1, 1, 1)`.

**Throws**

- `RangeError` if `index` is not an integer, or is outside `[0, maxLights)`. The same message as `disableLight`.
- `Error` if `params` includes attenuation fields, spot fields, or a `position` with `w` not equal to `0`. The message starts with `FF: positional and spot lights arrive in FF v1.2`. Positional and spot lights arrive in v1.2. The light does not change.

**Debug warnings**: None.

**GL2 equivalent**: `glLightfv` with `GL_LIGHT0` and `GL_POSITION`, `GL_AMBIENT`, `GL_DIFFUSE` or `GL_SPECULAR`.

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

**Throws**

- `RangeError` if `shininess` is outside `[0, 128]`, or is `NaN`. The message has this form: `FF: shininess N is outside [0, 128].`
- `Error` if `params` includes `emissive`. Emissive color arrives in v1.1. The material does not change.

**Debug warnings**: None.

**GL2 equivalent**: `glMaterialfv` with `GL_FRONT_AND_BACK` and `GL_AMBIENT`, `GL_DIFFUSE`, `GL_SPECULAR` or `GL_SHININESS`.

### Drawing

#### drawArrays

```ts
drawArrays(mode: GLenum, first: number, count: number): void
```

Calls `flush()`, then `gl.drawArrays`. Draws with the FF program and the bound VAO.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `mode` | `GLenum` | The primitive type, for example `gl.TRIANGLES`. |
| `first` | `number` | The first vertex index. |
| `count` | `number` | The number of vertices. |

**Throws**: None from FF. WebGL reports invalid calls as error codes. In debug mode, FF reports them as a warning. See [Debug warnings](#debug-warnings).

**Debug warnings**

- `[FF] No position data bound: did you bind your VAO?`
- `[FF] Lighting is on but every light is disabled; only global ambient will show.`
- `[FF] Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (...)`
- `[FF] Vertex colors are ignored under lighting unless COLOR_MATERIAL is enabled.`
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

The number of lights that FF supports. The value is `1` in v1.0.

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

The FF version string, for example `'1.0.0'`. Same value as `FF_VERSION`.

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
| `UV` | `3` | Reserved. Sampled from v1.1. |

**GL2 equivalent**: `glVertexPointer` (`POSITION`), `glNormalPointer` (`NORMAL`), `glColorPointer` (`COLOR`), `glTexCoordPointer` (`UV`).

#### COLOR_MATERIAL

```ts
const COLOR_MATERIAL = 'colorMaterial'
```

The capability name for color material. When on, the vertex color replaces the material ambient and diffuse values in the lighting math.

**GL2 equivalent**: `GL_COLOR_MATERIAL`.

#### FF_VERSION

```ts
const FF_VERSION = '1.0.0'
```

The FF version string.

**GL2 equivalent**: None.

#### LIGHTING

```ts
const LIGHTING = 'lighting'
```

The capability name for lighting. When off, FF outputs the vertex color.

**GL2 equivalent**: `GL_LIGHTING`.

### Types

#### Capability

```ts
type Capability = typeof LIGHTING | typeof COLOR_MATERIAL
```

The names accepted by `enable`, `disable` and `isEnabled`: `'lighting'` and `'colorMaterial'`.

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
  readonly matrices: Readonly<Record<'projection' | 'view' | 'model' | 'normal', readonly number[]>>;
  readonly eyePosition: readonly number[];
  readonly globalAmbient: readonly number[];
  readonly lights: readonly Readonly<{
    enabled: boolean;
    position: readonly number[];
    ambient: readonly number[];
    diffuse: readonly number[];
    specular: readonly number[];
  }>[];
  readonly material: Readonly<{
    ambient: readonly number[];
    diffuse: readonly number[];
    specular: readonly number[];
    shininess: number;
  }>;
}
```

The return type of `getState`. Matrices are column-major arrays of 16 numbers, and the normal matrix has 9.

#### FixedFunction

```ts
interface FixedFunction { /* members listed in the API reference */ }
```

The object returned by `createFixedFunction`. Its members are listed in the groups above: `version`, `maxLights`, `program`, the capability functions, the attribute functions, the matrix functions, the lighting functions, `setMaterial`, the drawing functions and `getState`.

#### LightParams

```ts
interface LightParams {
  position?: ReadonlyVec4; // world space, w must be 0
  ambient?: Color;
  diffuse?: Color;
  specular?: Color;
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

FF computes lighting per vertex in world space:

1. Ambient: material ambient times global ambient, plus light ambient times material ambient.
2. Diffuse: Lambert term, `max(n . l, 0)`, times material diffuse and light diffuse.
3. Specular: Phong term, `pow(max(r . v, 0), shininess)`, times material specular and light specular. `r = 2(n . l)n - l`. FF computes specular only when `n . l > 0`; otherwise the term is `0`. When `shininess` is `0`, the factor is `1`.
4. The primary color is the sum of ambient and diffuse. It is clamped to `[0, 1]` in the vertex shader.
5. The specular color is added after the primary color in the fragment shader.

The lit alpha value comes from material diffuse alpha. When `COLOR_MATERIAL` is on, it comes from the vertex color alpha. The unlit path outputs the vertex color, including its alpha.

## Debug warnings

All warnings except the view-matrix warning require `debug: true` in `createFixedFunction`. FF prints each warning with `console.warn`, once per FF instance and warning kind. GL errors print once per error code and draw function. Each message starts with `[FF] `.

| Condition | Message |
|---|---|
| A matrix passed to `setProjectionMatrix`, `setViewMatrix`, `setModelMatrix` or `setNormalMatrix` contains `NaN` or `Infinity` | `[FF] <name> contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).` `<name>` is `projection matrix`, `view matrix`, `model matrix` or `normal matrix`. |
| No position array is enabled at draw time | `[FF] No position data bound: did you bind your VAO?` |
| Lighting is on and every light is disabled | `[FF] Lighting is on but every light is disabled; only global ambient will show.` |
| Lighting is on and the model matrix changed without `setNormalMatrix` | `[FF] Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (...)`. The message ends with a parenthetical reference that this document omits. |
| Lighting is on, `COLOR_MATERIAL` is off, and the color array is enabled | `[FF] Vertex colors are ignored under lighting unless COLOR_MATERIAL is enabled.` |
| A WebGL error is raised after a draw call | `[FF] GL error <NAME> after <drawArrays or drawElements>.` `<NAME>` is `INVALID_ENUM`, `INVALID_VALUE`, `INVALID_OPERATION`, `OUT_OF_MEMORY` or `CONTEXT_LOST_WEBGL`. Other codes print as a number. |
| The view matrix is not invertible | `[FF] View matrix is not invertible; the eye position was not updated.` This warning prints even when `debug` is `false`. |

## Errors

FF throws these errors. The `debug` option does not change them.

| Condition | Error type | Source |
|---|---|---|
| A vertex or fragment shader fails to compile | `Error` | `createFixedFunction` |
| The program fails to link | `Error` | `createFixedFunction` |
| A light index is not an integer, or is outside `[0, maxLights)` | `RangeError` | `setLight`, `enableLight`, `disableLight` |
| `setLight` gets attenuation fields, spot fields, or a `position` with `w` not `0`. Arrives in v1.2. | `Error` | `setLight` |
| `enable`, `disable` or `isEnabled` gets `'texture2D'`. Arrives in v1.1. | `Error` | `enable`, `disable`, `isEnabled` |
| `enable`, `disable` or `isEnabled` gets `'fog'`. Arrives in v1.2. | `Error` | `enable`, `disable`, `isEnabled` |
| `enable`, `disable` or `isEnabled` gets any other unknown name | `Error` | `enable`, `disable`, `isEnabled` |
| `setMaterial` gets `emissive`. Arrives in v1.1. | `Error` | `setMaterial` |
| `setMaterial` gets a `shininess` outside `[0, 128]`, or `NaN` | `RangeError` | `setMaterial` |

## Version roadmap

| Version | Features |
|---|---|
| v1.0.0 (current) | Unlit and lit drawing. One directional light. One material. Per-vertex Phong lighting in world space. Matrix state. Debug warnings. |
| v1.1 | `texture2D` capability. `ATTRIB.UV` vertex data. `emissive` material color. |
| v1.2 | `fog` capability. Positional and spot lights. Attenuation fields in `LightParams`. |
