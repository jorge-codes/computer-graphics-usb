# Solar System: Hierarchical Transformations

A yellow Sun, a blue Earth and a white Moon. The Earth orbits the Sun. The Moon orbits the Earth. The Sun and the Earth also spin on their own axes. Thin lines show the two orbits. The example uses the FixedFunction (FF) module, so no shader code appears in the example. The code shows how transforms combine across the hierarchy.

## Requirements

- Node.js 20.19 or later in the 20 series, or 22.12 or later (tested with Node 24)
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

- Press `R` to pause or resume the motion.
- Holding a key counts as one press. Key auto-repeat is ignored.
- The light is one fixed directional light. It does not come from the Sun.

## Game loop

Each frame runs three steps in this order:

1. `processInput` handles the `R` press recorded since the last frame.
2. `update(dt)` changes the angles of the Sun, the Earth and the Moon.
3. `render` draws the scene.

`dt` is the time since the last frame, in seconds. The value is clamped to 0.1 s. A hidden tab does not make the scene jump when the tab becomes visible again. Speeds are in radians per second. The motion runs at the same speed on a 60 Hz display and on a 120 Hz display.

## Hierarchical transformations

A hierarchy describes which body moves relative to which body. The Earth moves around the Sun. The Moon moves around the Earth, so the Moon moves with the Earth. The Sun spin does not move the Earth.

Each body has two matrices in this example:

- The frame is the transform that the body passes to its children. It holds the position and the orbit of the body.
- The model is the transform that draws the body. It is the frame, then the own spin (Sun and Earth only), then the own size.

The code builds each frame from its parent frame. Then it builds each model from its frame. Only a frame is passed to children. A model is used for drawing only.

gl-matrix multiplies on the right. A call such as `mat4.rotateY(out, a, r)` computes `a * R`. The code reads from parent to child. The last call applies first to the vertices. Read the calls in `src/main.ts` from top to bottom to see the order.

## Exercises

1. Build the Moon from the Earth model matrix instead of the Earth frame. What happens to the Moon? Why?
2. Use the Sun model matrix as the parent of the Earth frame. What changes on screen?
3. Tilt the Earth axis by 23.4 degrees. Does the tilt direction stay fixed while the Earth orbits the Sun? Why or why not?
4. Add Mars with two moons. Which frames do you need? Which orbit lines do you need? Move the camera if Mars leaves the view.
5. Why does the Moon always show the same face to the Earth? Which angle makes this happen?

## Research

- `glPushMatrix` and `glPopMatrix` store and restore the matrix stack in fixed-function OpenGL. Find out how they relate to the frames in this example.
- Scene graphs store the hierarchy as a tree of objects. Look up `Object3D.add` in Three.js. Find out how it sets the parent of an object.

## Other commands

| Command           | Action                                          |
| ----------------- | ----------------------------------------------- |
| `npm run build`   | Type-check with `tsc` and build to `dist/`      |
| `npm run preview` | Serve the built `dist/` folder locally          |

## Project layout

```
index.html                 page markup
src/main.ts                WebGL setup, the game loop, frames, models, and the canvas
src/constants.ts           cube geometry, body sizes, orbit radii, colors, and clear color (#1b1e2b)
src/vendor/ff/             FF v1.0 (read only; do not edit)
```

## Troubleshooting

- **Blank page or "WebGL2 is not available."** Enable hardware acceleration in the browser, or try another browser.
- **Port 5173 is in use.** Stop the other process, or run `npx vite --port 3000`.
