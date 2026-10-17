# Rotating Cube: FixedFunction and a game loop

A yellow cube rotates on the Y axis. One directional light shines on it. The example uses the FixedFunction (FF) module, so no shader code appears in the example. The code shows the game loop that drives the animation.

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

- Press `Space` to change the cube color. The color cycles yellow → cyan → magenta → yellow.
- Press `R` to stop or restart the rotation.
- Holding a key counts as one press. Key auto-repeat is ignored.

## Game loop

Each frame runs three steps in this order:

1. `processInput` handles the `Space` and `R` presses recorded since the last frame.
2. `update(dt)` changes the rotation angle.
3. `render` draws the scene.

`dt` is the time since the last frame, in seconds. The value is clamped to 0.1 s. A hidden tab does not make the cube jump when the tab becomes visible again. The rotation speed is in radians per second. The cube turns at the same speed on a 60 Hz display and on a 120 Hz display.

## Other commands

| Command           | Action                                          |
| ----------------- | ----------------------------------------------- |
| `npm run build`   | Type-check with `tsc` and build to `dist/`      |
| `npm run preview` | Serve the built `dist/` folder locally          |

## Project layout

```
index.html                 page markup
src/main.ts                WebGL setup, the game loop, and the canvas
src/constants.ts           geometry, colors, and clear color (#1b1e2b)
src/vendor/ff/             FF v1.0 (read only; do not edit)
```

## Troubleshooting

- **Blank page or "WebGL2 is not available."** Enable hardware acceleration in the browser, or try another browser.
- **Port 5173 is in use.** Stop the other process, or run `npx vite --port 3000`.
