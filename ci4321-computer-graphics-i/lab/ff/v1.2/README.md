# FixedFunction (FF) v1.2.0

Emulates the OpenGL 2 fixed-function pipeline on WebGL2: lighting with up to eight lights, texturing, fog, matrices and generic attributes.
Do not edit the code or the shaders.

## Requirements

- A WebGL2 context.
- `gl-matrix`.
- A bundler that supports `?raw` imports, for example Vite. `ff.ts` imports the shaders with `?raw`.

## Files

- `ff.ts`: the API
- `ff.vert.glsl`, `ff.frag.glsl`: the shaders
- `DOCS.md`: usage guide and API reference
