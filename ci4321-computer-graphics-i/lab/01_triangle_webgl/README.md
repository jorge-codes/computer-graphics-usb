# RGB Triangle: FixedFunction vs. vanilla WebGL2

One RGB triangle, written two ways. Both versions render the same image.

- `src/examples/triangle.ff.ts` uses the FixedFunction (FF) module. The shaders stay hidden.
- `src/examples/triangle.vanilla.ts` uses raw WebGL2. The shaders are visible.

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

- Click "FF (main)" or "Vanilla WebGL2 (second)" to switch versions.
- Press `T` to toggle with the keyboard.
- The right panel shows the source file of the active version.
- The URL hash (`#ff` or `#vanilla`) stores the selection.

## Other commands

| Command           | Action                                          |
| ----------------- | ----------------------------------------------- |
| `npm run build`   | Type-check with `tsc` and build to `dist/`      |
| `npm run preview` | Serve the built `dist/` folder locally          |

## Project layout

```
index.html                 page markup
src/main.ts                toggle, canvas swap, source panel
src/examples/shared.ts     vertex data and clear color (#1b1e2b)
src/examples/triangle.*.ts the two implementations
src/vendor/ff/             FF v1.0 (read only; do not edit)
```

## Troubleshooting

- **Blank page or "WebGL2 is not available."** Enable hardware acceleration in the browser, or try another browser.
- **Port 5173 is in use.** Stop the other process, or run `npx vite --port 3000`.
