# Texture Mapping: Textured Cube and Quads with FixedFunction

This example teaches texture mapping: UVs, texture objects, filtering, material x texture, and transparency. A wooden cube rotates on the Y axis, on the right. A quad on the left shows a camouflage texture. A second quad, in the middle, shows a bush sprite with a transparent background. One directional light shines on all objects. Every cube face shows the same wood texture. The `C` key changes the material color of the camo quad, to show how the color changes the texture. The example uses the FixedFunction (FF) module version 1.2, so no shader code appears in the example. A game loop drives the animation.

## Requirements

- Node.js 18 or later (tested with Node 24)
- npm
- A browser with WebGL2 support

## Run

1. Install the dependencies. This is the only step that needs a network connection.

   ```
   npm install
   ```

2. Start the development server.

   ```
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## Use

- Press `R` to stop or restart the rotation.
- Press `C` to change the camo quad color between white and yellow. The bush material stays white and emissive.
- Holding a key counts as one press. Key auto-repeat is ignored.

## Game loop

Each frame runs three steps in this order:

1. `processInput` handles the `R` and `C` presses recorded since the last frame.
2. `update(dt)` changes the rotation angle.
3. `render` draws the cube, the camo quad, and the bush quad.

`dt` is the time since the last frame, in seconds. The value is clamped to 0.1 s. A hidden tab does not make the cube jump when the tab becomes visible again. The rotation speed is in radians per second. The cube turns at the same speed on a 60 Hz display and on a 120 Hz display.

## Texture

- The cube uses `src/textures/Wood_07-512x512.png` (512 x 512 pixels). The camo quad uses `src/textures/camo.png` (256 x 256 pixels). The bush quad uses `src/textures/bush.png` (53 x 42 pixels, with transparency).
- `main.ts` imports the image with Vite: `import woodUrl from './textures/Wood_07-512x512.png'`. The import gives the URL of the image. The camo and bush images use the same pattern.
- `createTexture` loads the image, then copies it to the GPU on `TEXTURE_UNIT`. FF samples that unit. FF does not create or bind textures.
- The quad has the same vertex layout as the cube, so `createVAO` works for both. The camo quad and the bush quad share one quad VAO.
- Before each draw, `render` binds the texture of that object on `TEXTURE_UNIT`. FF samples the texture that is bound at draw time.
- Each face and the quad use the full image. The UV values are (0, 0) at the bottom left and (1, 1) at the top right. Each vertex stores its own `s, t` pair in `src/constants.ts`.
- Image rows start at the top, but `t = 0` is the bottom in GL. The code sets `UNPACK_FLIP_Y_WEBGL` so the image is upright.
- `createTexture` takes a `filter` argument. It sets both the minification and the magnification filter. Wood and camo use `LINEAR`. The bush uses `NEAREST`.
- `LINEAR` blends neighbor texels. `NEAREST` picks one texel, so pixel-art edges stay sharp. `NEAREST` also does not blend the color of transparent texels into the edge, which can cause dark fringes.
- The default minification filter needs mipmaps, and the example makes none. Without an explicit filter, the texture samples as black.
- Texturing multiplies the lit material color by the texel, one channel at a time. `render` sets the material before each draw.
- `setMaterial` changes only the fields you pass. The material persists across draws and frames. The bush sets `emissive` to white, so the cube and camo draws reset `emissive` to (0, 0, 0). Without the reset, the bush emissive from the previous frame would light them.
- The cube material is white (1, 1, 1). White does not tint the texture, but lighting still shades it.
- The camo quad has no emissive, so lighting shades it. The ambient term gives about 0.2 and the diffuse term gives about 0.33, so the lit color is about 0.53. The camo shows its texture at about half brightness, dimmer than the bush.
- The camo quad material is white or yellow (1, 1, 0). Yellow has no blue, so the result has no blue. White areas of the camo turn yellow. Gray areas turn dark yellow (olive).
- Exercise: call `gl.generateMipmap`, then set only `TEXTURE_MIN_FILTER` to `LINEAR_MIPMAP_LINEAR`. Do not pass it as `filter`. `TEXTURE_MAG_FILTER` accepts only `NEAREST` or `LINEAR`.

## Transparency

- The bush material has white `emissive`. FF adds `emissive` to the lit color, then clamps the sum to 1. Emissive 1 plus the lit terms is at least 1, so the clamp gives 1. The bush shows its texture colors at full brightness, whatever the light does.
- FF outputs the alpha as texture alpha x material diffuse alpha. The bush material alpha is 1, so the texture alpha alone decides.
- FF does not enable blending. The app does: `setupState` calls `gl.enable(gl.BLEND)` and `gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)`. This matches `glEnable(GL_BLEND)` in GL2. Opaque draws have alpha 1, so blending does not change them.
- The bush quad is scaled by `BUSH_ASPECT` (image width / height) in X, so the image is not squashed.
- `render` draws the bush last. Blending mixes the new color with the color already in the framebuffer, so the opaque objects must be there first.
- Depth caveat: transparent texels still write depth. An object drawn after the bush, behind it, is hidden even where the bush is transparent.
- Research: depth mask, back-to-front sorting, and `discard` in a fragment shader (FF has no alpha test).

## Other commands

| Command           | Action                                          |
| ----------------- | ----------------------------------------------- |
| `npm run build`   | Type-check with `tsc` and build to `dist/`      |
| `npm run preview` | Serve the built `dist/` folder locally          |

## Project layout

```
index.html                 page markup
src/main.ts                WebGL setup, the game loop, and the canvas
src/constants.ts           cube and quad geometry, quad colors, object positions, bush aspect, and clear color (#1b1e2b)
src/textures/              the wood, camo, and bush images
src/vendor/ff/             FF v1.2 (read only; do not edit)
```

## Troubleshooting

- **Blank page or "WebGL2 is not available."** Enable hardware acceleration in the browser, or try another browser.
- **Port 5173 is in use.** Stop the other process, or run `npx vite --port 3000`.

## Credits

The image credits for the wood, camo and bush textures are not known.
