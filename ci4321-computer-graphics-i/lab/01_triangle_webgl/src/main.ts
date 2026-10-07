// Page scaffolding only: toggle, canvas swap and source panel.
import './style.css';
import { run as runFF } from './examples/triangle.ff';
import { run as runVanilla } from './examples/triangle.vanilla';
import ffSource from './examples/triangle.ff.ts?raw';
import vanillaSource from './examples/triangle.vanilla.ts?raw';

type Mode = 'ff' | 'vanilla';

const examples: Record<Mode, { file: string; source: string; run: (canvas: HTMLCanvasElement) => void }> = {
  ff: { file: 'triangle.ff.ts', source: ffSource, run: runFF },
  vanilla: { file: 'triangle.vanilla.ts', source: vanillaSource, run: runVanilla },
};

const stage = document.getElementById('stage')!;
const fileName = document.getElementById('file-name')!;
const source = document.getElementById('source')!;
const buttons: Record<Mode, HTMLElement> = {
  ff: document.getElementById('btn-ff')!,
  vanilla: document.getElementById('btn-vanilla')!,
};

function show(mode: Mode): void {
  // A fresh canvas gives a fresh WebGL context, so no state leaks between versions.
  const canvas = document.createElement('canvas');
  stage.replaceChildren(canvas);
  examples[mode].run(canvas);

  fileName.textContent = examples[mode].file;
  source.textContent = examples[mode].source;
  for (const m of Object.keys(buttons) as Mode[]) buttons[m].setAttribute('aria-pressed', String(m === mode));
  history.replaceState(null, '', `#${mode}`);
}

const current = (): Mode => (location.hash === '#vanilla' ? 'vanilla' : 'ff');

buttons.ff.addEventListener('click', () => show('ff'));
buttons.vanilla.addEventListener('click', () => show('vanilla'));
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) show(current() === 'ff' ? 'vanilla' : 'ff');
});

show(current());
