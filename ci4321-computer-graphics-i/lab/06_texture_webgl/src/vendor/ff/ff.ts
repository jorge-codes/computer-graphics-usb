// FixedFunction (FF) v1.2.0. Emulates the OpenGL 2 fixed-function pipeline.
// Do not edit.
import { mat4, vec3 } from 'gl-matrix';
import type { ReadonlyMat3, ReadonlyMat4, ReadonlyVec3, ReadonlyVec4 } from 'gl-matrix';
import vertSrc from './ff.vert.glsl?raw';
import fragSrc from './ff.frag.glsl?raw';

/** RGB color: red, green and blue as numbers, typically in [0, 1]. */
export type RGB = readonly [number, number, number];
/** RGBA color: red, green, blue and alpha as numbers, typically in [0, 1]. */
export type RGBA = readonly [number, number, number, number];

/** A color as RGB or RGBA. An RGB color has an alpha of 1. */
export type Color = RGB | RGBA;

/** FixedFunction library version, such as "1.2.0". */
export const FF_VERSION = '1.2.0';

/**
 * Fixed attribute locations. Bind vertex data to these slots.
 *
 * Equivalent to GL2's glVertexPointer (POSITION), glNormalPointer (NORMAL), glColorPointer (COLOR)
 * and glTexCoordPointer (UV).
 *
 * @see glVertexPointer
 */
export const ATTRIB = { POSITION: 0, NORMAL: 1, COLOR: 2, UV: 3 } as const;

/**
 * Capability name for lighting (GL_LIGHTING).
 *
 * When enabled, the color comes from lighting. When disabled, the output is the color attribute.
 *
 * @defaultValue Disabled.
 * @see glEnable
 */
export const LIGHTING = 'lighting';
/**
 * Capability name for color material (GL_COLOR_MATERIAL).
 *
 * When enabled with lighting, the vertex color replaces the material ambient and diffuse colors.
 * The alpha comes from the vertex color.
 *
 * @defaultValue Disabled.
 * @see glEnable
 */
export const COLOR_MATERIAL = 'colorMaterial';

/**
 * Capability name for 2D texturing (GL_TEXTURE_2D).
 *
 * When enabled, FF samples the texture bound to TEXTURE_UNIT at the UV coordinates, after the texture matrix,
 * and modulates the color with it. FF never binds textures. Bind yours on TEXTURE_UNIT first.
 *
 * @defaultValue Disabled.
 * @see glEnable
 */
export const TEXTURE_2D = 'texture2D';
/**
 * Capability name for fog (GL_FOG).
 *
 * When enabled, FF blends the final color toward the fog color with linear fog. FF computes the fog factor per vertex and blends per fragment.
 * It applies to lit and unlit draws. Set the fog parameters with setFog.
 *
 * @defaultValue Disabled.
 * @see glEnable
 */
export const FOG = 'fog';

/**
 * Texture unit that FF samples. FF sets its sampler to this unit once, at creation.
 * Bind your texture here: gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT).
 *
 * @see glActiveTexture
 */
export const TEXTURE_UNIT = 0 as const;

/** Capability names accepted by enable, disable and isEnabled. */
export type Capability = typeof LIGHTING | typeof COLOR_MATERIAL | typeof TEXTURE_2D | typeof FOG;

/** Options for createFixedFunction. */
export interface FFOptions {
  /**
   * Validate usage and warn once per issue through console.warn.
   *
   * Checks for NaN or Infinity in matrices, a missing position attribute, lighting with no enabled light,
   * a stale normal matrix, vertex colors ignored under lighting, texturing with nothing bound to unit 0,
   * and GL errors after each draw.
   *
   * @defaultValue false
   */
  debug?: boolean;
}

/** Parameters for setLight. Each omitted field keeps its current value. */
export interface LightParams {
  /**
   * World-space position, homogeneous. FF never transforms it.
   * With w = 0 the light is directional and the xyz values point toward the light.
   * With w = 1 the light is positional and the xyz values are its position.
   *
   * @defaultValue [0, 0, 1, 0]
   */
  position?: ReadonlyVec4;
  /**
   * Ambient color of the light.
   *
   * @defaultValue [0, 0, 0, 1]
   */
  ambient?: Color;
  /**
   * Diffuse color of the light.
   *
   * @defaultValue [1, 1, 1, 1]
   */
  diffuse?: Color;
  /**
   * Specular color of the light.
   *
   * @defaultValue [1, 1, 1, 1]
   */
  specular?: Color;
  /**
   * Constant term of the distance attenuation 1 / (kc + kl d + kq d²). Positional lights only.
   *
   * @defaultValue 1
   * @throws {RangeError} If the value is negative or not finite.
   */
  constantAttenuation?: number;
  /**
   * Linear term of the distance attenuation. Positional lights only.
   *
   * @defaultValue 0
   * @throws {RangeError} If the value is negative or not finite.
   */
  linearAttenuation?: number;
  /**
   * Quadratic term of the distance attenuation. Positional lights only.
   *
   * @defaultValue 0
   * @throws {RangeError} If the value is negative or not finite.
   */
  quadraticAttenuation?: number;
  /**
   * World-space direction of the spot cone axis. FF normalizes it and stores the unit vector.
   *
   * @defaultValue [0, 0, -1]
   * @throws {RangeError} If the vector has zero length or is not finite.
   */
  spotDirection?: ReadonlyVec3;
  /**
   * Half-angle of the spot cone, in radians, in [0, π/2]. The value Math.PI means the light is not a spot.
   *
   * @defaultValue Math.PI
   * @throws {RangeError} If the value is outside [0, π/2] and is not Math.PI.
   * @see glLightf(GL_SPOT_CUTOFF)
   */
  spotCutoff?: number;
  /**
   * Spot exponent, in [0, 128]. A higher value concentrates the light at the cone axis.
   * Has no effect when spotCutoff is Math.PI.
   *
   * @defaultValue 0
   * @throws {RangeError} If the value is outside [0, 128].
   * @see glLightf(GL_SPOT_EXPONENT)
   */
  spotExponent?: number;
}

/** Parameters for setMaterial. Each omitted field keeps its current value. */
export interface MaterialParams {
  /**
   * Ambient reflectance of the material.
   *
   * @defaultValue [0.2, 0.2, 0.2, 1]
   */
  ambient?: Color;
  /**
   * Diffuse reflectance of the material.
   *
   * @defaultValue [0.8, 0.8, 0.8, 1]
   */
  diffuse?: Color;
  /**
   * Specular reflectance of the material.
   *
   * @defaultValue [0, 0, 0, 1]
   */
  specular?: Color;
  /**
   * Specular exponent, in [0, 128]. A value of 0 uses a specular factor of 1
   * on faces lit by the light (n·l > 0). Specular is always 0 elsewhere.
   *
   * @defaultValue 0
   * @throws {RangeError} If the value is outside [0, 128].
   * @see glMaterialfv
   */
  shininess?: number;
  /**
   * Emitted color of the material. Lighting adds it to the primary color. Lights do not change it.
   *
   * @defaultValue [0, 0, 0, 1]
   * @see glMaterialfv(GL_EMISSION)
   */
  emissive?: Color;
}

/** Parameters for setFog. Each omitted field keeps its current value. */
export interface FogParams {
  /**
   * Fog color. FF uses the RGB values.
   *
   * @defaultValue [0, 0, 0, 1]
   * @see glFogfv(GL_FOG_COLOR)
   */
  color?: Color;
  /**
   * Eye-space distance where fog starts. Closer vertices have no fog.
   *
   * @defaultValue 0
   * @see glFogf(GL_FOG_START)
   */
  start?: number;
  /**
   * Eye-space distance where fog is complete. Farther vertices have the fog color.
   *
   * @defaultValue 1
   * @throws {RangeError} If the resulting end is not greater than the resulting start.
   * @see glFogf(GL_FOG_END)
   */
  end?: number;
}

/**
 * Read-only copy of the FF state, returned by getState. Later calls do not change it.
 */
export interface FFStateSnapshot {
  /** FF library version. */
  readonly version: string;
  /** Capability flags. True means enabled. */
  readonly capabilities: Readonly<Record<Capability, boolean>>;
  /**
   * Matrices as column-major arrays. Projection, view and model have 16 numbers. Normal and texture have 9 numbers (3x3).
   */
  readonly matrices: Readonly<Record<'projection' | 'view' | 'model' | 'normal' | 'texture', readonly number[]>>;
  /** Eye position in world space, as 3 numbers. */
  readonly eyePosition: readonly number[];
  /** Global ambient color, as RGBA numbers. */
  readonly globalAmbient: readonly number[];
  /** State of each light, in index order. The length equals maxLights. */
  readonly lights: readonly Readonly<{
    enabled: boolean;
    position: readonly number[];
    ambient: readonly number[];
    diffuse: readonly number[];
    specular: readonly number[];
    /** Attenuation terms: constant, linear, quadratic. */
    attenuation: readonly number[];
    /** Unit spot direction, in world space. */
    spotDirection: readonly number[];
    /** Spot cutoff in radians. Math.PI means the light is not a spot. */
    spotCutoff: number;
    /** Spot exponent, as the student set it. */
    spotExponent: number;
  }>[];
  /** Material state. */
  readonly material: Readonly<{
    ambient: readonly number[];
    diffuse: readonly number[];
    specular: readonly number[];
    shininess: number;
    emissive: readonly number[];
  }>;
  /** Fog state. */
  readonly fog: Readonly<{
    color: readonly number[];
    start: number;
    end: number;
  }>;
}

/**
 * FixedFunction instance, returned by createFixedFunction.
 *
 * Setters store state and mark it dirty. flush uploads dirty state to the GPU.
 * drawArrays and drawElements call flush first.
 */
export interface FixedFunction {
  /** FF library version. */
  readonly version: string;
  /** Number of lights. Light indices run from 0 to maxLights - 1. Equals 8 in v1.2. */
  readonly maxLights: number;
  /** The linked WebGL program. FF creates and owns it. flush binds it. */
  readonly program: WebGLProgram;

  /**
   * Enable a capability.
   *
   * @param cap Capability to enable.
   * @throws {Error} If cap is not LIGHTING, COLOR_MATERIAL, TEXTURE_2D or FOG.
   * @see glEnable
   */
  enable(cap: Capability): void;
  /**
   * Disable a capability.
   *
   * @param cap Capability to disable.
   * @throws {Error} If cap is not LIGHTING, COLOR_MATERIAL, TEXTURE_2D or FOG.
   * @see glDisable
   */
  disable(cap: Capability): void;
  /**
   * Check whether a capability is enabled.
   *
   * @param cap Capability to check.
   * @returns True if the capability is enabled.
   * @throws {Error} If cap is not LIGHTING, COLOR_MATERIAL, TEXTURE_2D or FOG.
   * @see glIsEnabled
   */
  isEnabled(cap: Capability): boolean;

  /**
   * Set the current color. Writes the generic color attribute immediately.
   *
   * The value applies only while the color attribute array is disabled. This is context state, not VAO state.
   * The default is (1, 1, 1, 1).
   *
   * @param color RGB or RGBA color. Alpha defaults to 1.
   * @see glColor4f
   */
  setColor(color: Color): void;
  /**
   * Set the current normal. Writes the generic normal attribute immediately.
   *
   * The value applies only while the normal attribute array is disabled. This is context state, not VAO state.
   * The default is (0, 0, 1).
   *
   * @param normal Normal vector.
   * @see glNormal3f
   */
  setNormal(normal: ReadonlyVec3): void;

  /**
   * Set the projection matrix. Uploads on the next flush.
   *
   * In debug mode, warns if the matrix contains NaN or Infinity.
   *
   * @param m Column-major 4x4 matrix.
   * @see glLoadMatrixf
   */
  setProjectionMatrix(m: ReadonlyMat4): void;
  /**
   * Set the view matrix. Uploads on the next flush.
   *
   * Also derives the eye position from the inverse view matrix. If the matrix is not invertible,
   * the eye position keeps its value. In debug mode, FF logs a warning once.
   *
   * In debug mode, warns if the matrix contains NaN or Infinity.
   *
   * @param m Column-major 4x4 matrix.
   * @see glLoadMatrixf
   */
  setViewMatrix(m: ReadonlyMat4): void;
  /**
   * Set the model matrix. Uploads on the next flush.
   *
   * Does not update the normal matrix. Call setNormalMatrix as well when lighting is enabled.
   *
   * In debug mode, warns if the matrix contains NaN or Infinity.
   *
   * @param m Column-major 4x4 matrix.
   * @see glLoadMatrixf
   */
  setModelMatrix(m: ReadonlyMat4): void;
  /**
   * Set the normal matrix. Uploads on the next flush.
   *
   * The normal matrix is the inverse transpose of the upper 3x3 of the model matrix.
   * gl-matrix provides mat3.normalFromMat4 for this calculation.
   *
   * In debug mode, warns if the matrix contains NaN or Infinity.
   *
   * @param m Column-major 3x3 matrix.
   */
  setNormalMatrix(m: ReadonlyMat3): void;

  /**
   * Set the global ambient light color. Uploads on the next flush. The default is (0.2, 0.2, 0.2, 1).
   *
   * @param color RGB or RGBA color. Alpha defaults to 1.
   * @see glLightModelfv(GL_LIGHT_MODEL_AMBIENT)
   */
  setGlobalAmbient(color: Color): void;
  /**
   * Set the parameters of one light. Only the fields in params change.
   *
   * FF checks every field before it changes any. If a field is not valid, the light keeps its state.
   *
   * @param index Light index, from 0 to maxLights - 1.
   * @param params Light parameters to set.
   * @throws {RangeError} If index is not an integer in [0, maxLights).
   * @throws {RangeError} If an attenuation, spotCutoff, spotExponent or spotDirection value is not valid.
   * @see glLightfv
   */
  setLight(index: number, params: LightParams): void;
  /**
   * Enable one light.
   *
   * @param index Light index, from 0 to maxLights - 1.
   * @throws {RangeError} If index is not an integer in [0, maxLights).
   * @see glEnable
   */
  enableLight(index: number): void;
  /**
   * Disable one light.
   *
   * @param index Light index, from 0 to maxLights - 1.
   * @throws {RangeError} If index is not an integer in [0, maxLights).
   * @see glDisable
   */
  disableLight(index: number): void;

  /**
   * Set material parameters. Only the fields in params change.
   *
   * @param params Material parameters to set.
   * @throws {RangeError} If shininess is outside [0, 128].
   * @see glMaterialfv
   */
  setMaterial(params: MaterialParams): void;

  /**
   * Set the texture matrix. Uploads on the next flush. The default is the identity.
   *
   * FF applies it to the UV coordinates as (u', v', 1) = T (u, v, 1).
   *
   * In debug mode, warns if the matrix contains NaN or Infinity.
   *
   * @param m Column-major 3x3 matrix.
   * @see glMatrixMode(GL_TEXTURE)
   */
  setTextureMatrix(m: ReadonlyMat3): void;

  /**
   * Set the fog parameters. Only the fields in params change. FOG must be enabled to see the effect.
   *
   * FF checks the resulting state. If it is not valid, the fog keeps its state.
   *
   * @param params Fog parameters to set.
   * @throws {RangeError} If the resulting end is not greater than the resulting start.
   * @see glFogfv
   */
  setFog(params: FogParams): void;

  /**
   * Bind the FF program and upload dirty state to the GPU.
   *
   * drawArrays and drawElements call flush first. Call flush directly to upload state without a draw.
   */
  flush(): void;
  /**
   * Flush state, then draw non-indexed primitives.
   *
   * In debug mode, validates state and checks for GL errors after the draw.
   *
   * @param mode Primitive type, such as gl.TRIANGLES.
   * @param first Index of the first vertex.
   * @param count Number of vertices.
   * @see glDrawArrays
   */
  drawArrays(mode: GLenum, first: number, count: number): void;
  /**
   * Flush state, then draw indexed primitives.
   *
   * In debug mode, validates state and checks for GL errors after the draw.
   *
   * @param mode Primitive type, such as gl.TRIANGLES.
   * @param count Number of indices.
   * @param type Index type, such as gl.UNSIGNED_SHORT.
   * @param offset Byte offset into the bound element array buffer.
   * @see glDrawElements
   */
  drawElements(mode: GLenum, count: number, type: GLenum, offset: number): void;

  /**
   * Return a snapshot of the current state.
   *
   * @returns Frozen copy of the state. Later calls do not change it.
   * @see FFStateSnapshot
   */
  getState(): Readonly<FFStateSnapshot>;
}

const MAX_LIGHTS = 8;

interface LightState {
  enabled: boolean;
  position: Float32Array;
  ambient: Float32Array;
  diffuse: Float32Array;
  specular: Float32Array;
  attenuation: Float32Array; // constant, linear, quadratic
  spotDirection: Float32Array; // unit length
  spotCutoff: number; // radians. Math.PI = not a spot
  spotCosCutoff: number; // cos(spotCutoff), or -2 when spotCutoff is Math.PI
  spotExponent: number; // as the student set it. The GPU gets 0 when the light is not a spot
}

const rgba = (c: Color): Float32Array => new Float32Array([c[0], c[1], c[2], c.length === 4 ? c[3] : 1]);

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`FF: shader compile failed:\n${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`FF: program link failed:\n${log}`);
  }
  return program;
}

/**
 * Create a FixedFunction instance. Compiles and links the FF shaders in the given context.
 *
 * Sets the current color to (1, 1, 1, 1) and the current normal to (0, 0, 1).
 * Lighting and color material are disabled by default.
 *
 * @param gl WebGL2 rendering context.
 * @param options Creation options.
 * @returns The FixedFunction instance.
 * @throws {Error} If a shader fails to compile or the program fails to link.
 * @example
 * ```ts
 * const ff = createFixedFunction(gl, { debug: true });
 * ff.disable(LIGHTING);
 * gl.bindVertexArray(vao);
 * ff.drawArrays(gl.TRIANGLES, 0, 3);
 * ```
 */
export function createFixedFunction(gl: WebGL2RenderingContext, options: FFOptions = {}): FixedFunction {
  const debug = options.debug ?? false;

  const program = linkProgram(gl, compileShader(gl, gl.VERTEX_SHADER, vertSrc), compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    model: uniform('u_model'),
    view: uniform('u_view'),
    projection: uniform('u_projection'),
    normalMatrix: uniform('u_normalMatrix'),
    textureMatrix: uniform('u_textureMatrix'),
    eyePosition: uniform('u_eyePosition'),
    lighting: uniform('u_lighting'),
    colorMaterial: uniform('u_colorMaterial'),
    texture2D: uniform('u_texture2D'),
    fog: uniform('u_fog'),
    sampler: uniform('u_sampler'),
    globalAmbient: uniform('u_globalAmbient'),
    lights: Array.from({ length: MAX_LIGHTS }, (_, i) => ({
      enabled: uniform(`u_lights[${i}].enabled`),
      position: uniform(`u_lights[${i}].position`),
      ambient: uniform(`u_lights[${i}].ambient`),
      diffuse: uniform(`u_lights[${i}].diffuse`),
      specular: uniform(`u_lights[${i}].specular`),
      attenuation: uniform(`u_lights[${i}].attenuation`),
      spotDirection: uniform(`u_lights[${i}].spotDirection`),
      spotCosCutoff: uniform(`u_lights[${i}].spotCosCutoff`),
      spotExponent: uniform(`u_lights[${i}].spotExponent`),
    })),
    material: {
      ambient: uniform('u_material.ambient'),
      diffuse: uniform('u_material.diffuse'),
      specular: uniform('u_material.specular'),
      emissive: uniform('u_material.emissive'),
      shininess: uniform('u_material.shininess'),
    },
    fogColor: uniform('u_fogColor'),
    fogStart: uniform('u_fogStart'),
    fogEnd: uniform('u_fogEnd'),
  };

  // The sampler reads TEXTURE_UNIT for the life of the program. Set it once, here.
  // This leaves the FF program bound, as the contract says flush does.
  gl.useProgram(program);
  gl.uniform1i(loc.sampler, TEXTURE_UNIT);

  // State, with GL2 defaults.
  const caps: Record<Capability, boolean> = { [LIGHTING]: false, [COLOR_MATERIAL]: false, [TEXTURE_2D]: false, [FOG]: false };
  const matrices = {
    projection: mat4.create() as Float32Array,
    view: mat4.create() as Float32Array,
    model: mat4.create() as Float32Array,
    normal: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    texture: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  };
  const eye = new Float32Array(3);
  const globalAmbient = new Float32Array([0.2, 0.2, 0.2, 1]);
  const lights: LightState[] = Array.from({ length: MAX_LIGHTS }, (_, i) => ({
    enabled: false,
    position: new Float32Array([0, 0, 1, 0]),
    ambient: new Float32Array([0, 0, 0, 1]),
    diffuse: new Float32Array(i === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]),
    specular: new Float32Array(i === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]),
    attenuation: new Float32Array([1, 0, 0]),
    spotDirection: new Float32Array([0, 0, -1]),
    spotCutoff: Math.PI,
    spotCosCutoff: -2,
    spotExponent: 0,
  }));
  const material = {
    ambient: new Float32Array([0.2, 0.2, 0.2, 1]),
    diffuse: new Float32Array([0.8, 0.8, 0.8, 1]),
    specular: new Float32Array([0, 0, 0, 1]),
    emissive: new Float32Array([0, 0, 0, 1]),
    shininess: 0,
  };
  const fog = {
    color: new Float32Array([0, 0, 0, 1]),
    start: 0,
    end: 1,
  };

  // Dirty tracking. Everything starts dirty so the first flush uploads all state.
  // Each light has its own key, so only the lights that changed upload.
  const lightKeys = Array.from({ length: MAX_LIGHTS }, (_, i) => `light${i}`);
  const dirty = new Set<string>([
    'projection', 'view', 'model', 'normal', 'textureMatrix', 'eye', 'switches', 'globalAmbient', ...lightKeys, 'material', 'fog',
  ]);

  // Scratch matrix for setViewMatrix, so each call does not allocate.
  const viewInverse = mat4.create();

  // Generic attribute values: GL2's "current color" and "current normal". Context state, not VAO state.
  gl.vertexAttrib4f(ATTRIB.COLOR, 1, 1, 1, 1);
  gl.vertexAttrib3f(ATTRIB.NORMAL, 0, 0, 1);

  // Debug helpers.
  const warned = new Set<string>();
  const warnOnce = (key: string, message: string) => {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[FF] ${message}`);
  };
  let normalMatrixStale = false;
  let lastCall = 'FF';

  const checkFinite = (name: string, m: ArrayLike<number>) => {
    if (!debug) return;
    for (let i = 0; i < m.length; i++) {
      if (!Number.isFinite(m[i])) {
        warnOnce(`nan-${name}`, `${name} contains NaN or Infinity (often a zero-length vector normalized, e.g., lookAt with forward parallel to up).`);
        return;
      }
    }
  };

  const checkLightIndex = (index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_LIGHTS) {
      throw new RangeError(`FF: light index ${index} is outside [0, ${MAX_LIGHTS}). FF v1.2 has ${MAX_LIGHTS} lights (indices 0–${MAX_LIGHTS - 1}).`);
    }
  };

  const checkCap = (cap: string): Capability => {
    if (cap === LIGHTING || cap === COLOR_MATERIAL || cap === TEXTURE_2D || cap === FOG) return cap;
    throw new Error(`FF: unknown capability "${cap}".`);
  };

  const uploadLight = (i: number) => {
    const light = lights[i];
    const at = loc.lights[i];
    gl.uniform1i(at.enabled, light.enabled ? 1 : 0);
    gl.uniform4fv(at.position, light.position);
    gl.uniform4fv(at.ambient, light.ambient);
    gl.uniform4fv(at.diffuse, light.diffuse);
    gl.uniform4fv(at.specular, light.specular);
    gl.uniform3fv(at.attenuation, light.attenuation);
    gl.uniform3fv(at.spotDirection, light.spotDirection);
    gl.uniform1f(at.spotCosCutoff, light.spotCosCutoff);
    // A light that is not a spot has spotCosCutoff = -2, so the shader never culls it.
    // Its exponent must be 0 on the GPU too, so the shader gives a spot factor of 1 without a branch.
    // getState still reports the exponent the student set.
    gl.uniform1f(at.spotExponent, light.spotCutoff === Math.PI ? 0 : light.spotExponent);
  };

  const flush = () => {
    gl.useProgram(program);
    if (dirty.size === 0) return;
    if (dirty.has('projection')) gl.uniformMatrix4fv(loc.projection, false, matrices.projection);
    if (dirty.has('view')) gl.uniformMatrix4fv(loc.view, false, matrices.view);
    if (dirty.has('model')) gl.uniformMatrix4fv(loc.model, false, matrices.model);
    if (dirty.has('normal')) gl.uniformMatrix3fv(loc.normalMatrix, false, matrices.normal);
    if (dirty.has('textureMatrix')) gl.uniformMatrix3fv(loc.textureMatrix, false, matrices.texture);
    if (dirty.has('eye')) gl.uniform3fv(loc.eyePosition, eye);
    if (dirty.has('switches')) {
      gl.uniform1i(loc.lighting, caps[LIGHTING] ? 1 : 0);
      gl.uniform1i(loc.colorMaterial, caps[COLOR_MATERIAL] ? 1 : 0);
      gl.uniform1i(loc.texture2D, caps[TEXTURE_2D] ? 1 : 0);
      gl.uniform1i(loc.fog, caps[FOG] ? 1 : 0);
    }
    if (dirty.has('globalAmbient')) gl.uniform4fv(loc.globalAmbient, globalAmbient);
    for (let i = 0; i < MAX_LIGHTS; i++) {
      if (dirty.has(lightKeys[i])) uploadLight(i);
    }
    if (dirty.has('material')) {
      gl.uniform4fv(loc.material.ambient, material.ambient);
      gl.uniform4fv(loc.material.diffuse, material.diffuse);
      gl.uniform4fv(loc.material.specular, material.specular);
      gl.uniform4fv(loc.material.emissive, material.emissive);
      gl.uniform1f(loc.material.shininess, material.shininess);
    }
    if (dirty.has('fog')) {
      gl.uniform4fv(loc.fogColor, fog.color);
      gl.uniform1f(loc.fogStart, fog.start);
      gl.uniform1f(loc.fogEnd, fog.end);
    }
    dirty.clear();
  };

  const validateBeforeDraw = () => {
    if (!debug) return;
    if (!gl.getVertexAttrib(ATTRIB.POSITION, gl.VERTEX_ATTRIB_ARRAY_ENABLED)) {
      warnOnce('no-position', 'No position data bound: did you bind your VAO?');
    }
    if (caps[LIGHTING]) {
      if (!lights.some((l) => l.enabled)) {
        warnOnce('no-light', 'Lighting is on but every light is disabled; only global ambient and emissive will show.');
      }
      if (normalMatrixStale) {
        warnOnce('stale-normal', 'Normal matrix may be stale: the model matrix changed but setNormalMatrix was not called (lecture 2B/9A).');
      }
      if (!caps[COLOR_MATERIAL] && gl.getVertexAttrib(ATTRIB.COLOR, gl.VERTEX_ATTRIB_ARRAY_ENABLED)) {
        warnOnce('color-ignored', 'Vertex colors are ignored under lighting unless COLOR_MATERIAL is enabled.');
      }
    }
    if (caps[TEXTURE_2D]) {
      // Read the binding of unit 0, then restore the active unit the student had.
      const activeUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
      const bound = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.activeTexture(activeUnit);
      if (bound === null) {
        warnOnce('no-texture', 'Texturing is on but nothing is bound to TEXTURE0 (lecture 6A).');
      }
    }
  };

  const checkGlError = () => {
    if (!debug) return;
    const err = gl.getError();
    if (err === gl.NO_ERROR) return;
    const names: Record<number, string> = {
      [gl.INVALID_ENUM]: 'INVALID_ENUM',
      [gl.INVALID_VALUE]: 'INVALID_VALUE',
      [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
      [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
      [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL',
    };
    warnOnce(`gl-${err}-${lastCall}`, `GL error ${names[err] ?? err} after ${lastCall}.`);
  };

  return {
    version: FF_VERSION,
    maxLights: MAX_LIGHTS,
    program,

    enable(cap) {
      caps[checkCap(cap)] = true;
      dirty.add('switches');
    },
    disable(cap) {
      caps[checkCap(cap)] = false;
      dirty.add('switches');
    },
    isEnabled(cap) {
      return caps[checkCap(cap)];
    },

    setColor(color) {
      const c = rgba(color);
      gl.vertexAttrib4f(ATTRIB.COLOR, c[0], c[1], c[2], c[3]);
    },
    setNormal(normal) {
      gl.vertexAttrib3f(ATTRIB.NORMAL, normal[0], normal[1], normal[2]);
    },

    setProjectionMatrix(m) {
      checkFinite('projection matrix', m);
      matrices.projection.set(m);
      dirty.add('projection');
    },
    setViewMatrix(m) {
      checkFinite('view matrix', m);
      matrices.view.set(m);
      // Eye position = translation column of the inverse view matrix.
      const inverse = mat4.invert(viewInverse, matrices.view);
      if (inverse) eye.set([inverse[12], inverse[13], inverse[14]]);
      else if (debug) warnOnce('view-singular', 'View matrix is not invertible; the eye position was not updated.');
      dirty.add('view').add('eye');
    },
    setModelMatrix(m) {
      checkFinite('model matrix', m);
      matrices.model.set(m);
      normalMatrixStale = true;
      dirty.add('model');
    },
    setNormalMatrix(m) {
      checkFinite('normal matrix', m);
      matrices.normal.set(m);
      normalMatrixStale = false;
      dirty.add('normal');
    },
    setTextureMatrix(m) {
      checkFinite('texture matrix', m);
      matrices.texture.set(m);
      dirty.add('textureMatrix');
    },

    setGlobalAmbient(color) {
      globalAmbient.set(rgba(color));
      dirty.add('globalAmbient');
    },
    setLight(index, params) {
      checkLightIndex(index);

      // Check every field before changing any, so a failed call leaves the light untouched.
      const nonNegative = (name: string, value: number | undefined) => {
        if (value !== undefined && !(Number.isFinite(value) && value >= 0)) {
          throw new RangeError(`FF: ${name} ${value} must be finite and at least 0.`);
        }
      };
      nonNegative('constantAttenuation', params.constantAttenuation);
      nonNegative('linearAttenuation', params.linearAttenuation);
      nonNegative('quadraticAttenuation', params.quadraticAttenuation);
      const cutoff = params.spotCutoff;
      if (cutoff !== undefined && !(cutoff === Math.PI || (cutoff >= 0 && cutoff <= Math.PI / 2))) {
        throw new RangeError(`FF: spotCutoff ${cutoff} is outside [0, π/2]. Use Math.PI for a light that is not a spot.`);
      }
      const exponent = params.spotExponent;
      if (exponent !== undefined && !(exponent >= 0 && exponent <= 128)) {
        throw new RangeError(`FF: spotExponent ${exponent} is outside [0, 128].`);
      }
      const direction = params.spotDirection;
      if (direction) {
        const length = Math.hypot(direction[0], direction[1], direction[2]);
        // A zero vector would normalize to NaN. FF refuses it.
        if (!(Number.isFinite(length) && length > 0)) {
          throw new RangeError(`FF: spotDirection [${direction[0]}, ${direction[1]}, ${direction[2]}] must be finite and not zero-length.`);
        }
      }

      const light = lights[index];
      if (params.position) light.position.set(params.position);
      if (params.ambient) light.ambient.set(rgba(params.ambient));
      if (params.diffuse) light.diffuse.set(rgba(params.diffuse));
      if (params.specular) light.specular.set(rgba(params.specular));
      if (params.constantAttenuation !== undefined) light.attenuation[0] = params.constantAttenuation;
      if (params.linearAttenuation !== undefined) light.attenuation[1] = params.linearAttenuation;
      if (params.quadraticAttenuation !== undefined) light.attenuation[2] = params.quadraticAttenuation;
      if (direction) vec3.normalize(light.spotDirection as unknown as vec3, direction as unknown as vec3); // unit length, so the shader skips normalize
      if (cutoff !== undefined) {
        light.spotCutoff = cutoff;
        // Precompute cos(cutoff) once on the CPU. A cutoff of π means "not a spot": -2 is below any dot product.
        light.spotCosCutoff = cutoff === Math.PI ? -2 : Math.cos(cutoff);
      }
      if (exponent !== undefined) light.spotExponent = exponent;
      dirty.add(lightKeys[index]);
    },
    enableLight(index) {
      checkLightIndex(index);
      lights[index].enabled = true;
      dirty.add(lightKeys[index]);
    },
    disableLight(index) {
      checkLightIndex(index);
      lights[index].enabled = false;
      dirty.add(lightKeys[index]);
    },

    setMaterial(params) {
      if (params.shininess !== undefined && !(params.shininess >= 0 && params.shininess <= 128)) {
        throw new RangeError(`FF: shininess ${params.shininess} is outside [0, 128].`);
      }
      if (params.ambient) material.ambient.set(rgba(params.ambient));
      if (params.diffuse) material.diffuse.set(rgba(params.diffuse));
      if (params.specular) material.specular.set(rgba(params.specular));
      if (params.emissive) material.emissive.set(rgba(params.emissive));
      if (params.shininess !== undefined) material.shininess = params.shininess;
      dirty.add('material');
    },

    setFog(params) {
      // Validate the resulting state before committing, so a failed call leaves the fog untouched.
      const start = params.start ?? fog.start;
      const end = params.end ?? fog.end;
      if (!(end > start)) {
        throw new RangeError(`FF: fog end ${end} must be greater than fog start ${start}.`);
      }
      if (params.color) fog.color.set(rgba(params.color));
      fog.start = start;
      fog.end = end;
      dirty.add('fog');
    },

    flush,
    drawArrays(mode, first, count) {
      lastCall = 'drawArrays';
      flush();
      validateBeforeDraw();
      gl.drawArrays(mode, first, count);
      checkGlError();
    },
    drawElements(mode, count, type, offset) {
      lastCall = 'drawElements';
      flush();
      validateBeforeDraw();
      gl.drawElements(mode, count, type, offset);
      checkGlError();
    },

    getState() {
      const arr = (a: ArrayLike<number>) => Object.freeze(Array.from(a));
      return Object.freeze({
        version: FF_VERSION,
        capabilities: Object.freeze({ ...caps }),
        matrices: Object.freeze({
          projection: arr(matrices.projection),
          view: arr(matrices.view),
          model: arr(matrices.model),
          normal: arr(matrices.normal),
          texture: arr(matrices.texture),
        }),
        eyePosition: arr(eye),
        globalAmbient: arr(globalAmbient),
        lights: Object.freeze(
          lights.map((l) =>
            Object.freeze({
              enabled: l.enabled,
              position: arr(l.position),
              ambient: arr(l.ambient),
              diffuse: arr(l.diffuse),
              specular: arr(l.specular),
              attenuation: arr(l.attenuation),
              spotDirection: arr(l.spotDirection),
              spotCutoff: l.spotCutoff,
              spotExponent: l.spotExponent,
            }),
          ),
        ),
        material: Object.freeze({
          ambient: arr(material.ambient),
          diffuse: arr(material.diffuse),
          specular: arr(material.specular),
          shininess: material.shininess,
          emissive: arr(material.emissive),
        }),
        fog: Object.freeze({
          color: arr(fog.color),
          start: fog.start,
          end: fog.end,
        }),
      });
    },
  };
}
