// Placeholder iOS app icon and launch images (M18 S1, PLT-012) from public/icons/icon-512.png. Deterministic; the icon has no
// alpha channel (App Store rule), the launch image is the canvas grey with the icon in the middle. Replace with real art later.
import { readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const tunables = await readFile('src/config/tunables.ts', 'utf8');
const number = (key) => Number(tunables.match(new RegExp(`\\b${key}:\\s*([0-9.]+)`))?.[1]);
const iconPixels = number('iconPixels');
const splashPixels = number('splashPixels');
const iconRatio = number('splashIconRatio');
const grey = tunables.match(/canvasGrey:\s*'#([0-9A-Fa-f]{6})'/)?.[1];
if (![iconPixels, splashPixels, iconRatio].every(Number.isFinite) || !grey) {
  console.error('ios tunables or colors.canvasGrey not found');
  process.exit(1);
}
const background = [0, 2, 4].map((at) => parseInt(grey.slice(at, at + 2), 16));

const source = PNG.sync.read(await readFile('public/icons/icon-512.png'));
const channels = 4;

/** Bilinear scale of the source icon to a square of `size` pixels, written into `target` at (left, top). */
const drawScaled = (target, targetWidth, size, left, top) => {
  const ratio = (source.width - 1) / (size - 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x * ratio;
      const fy = y * ratio;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, source.width - 1);
      const y1 = Math.min(y0 + 1, source.height - 1);
      const wx = fx - x0;
      const wy = fy - y0;
      const at = ((top + y) * targetWidth + left + x) * channels;
      for (let c = 0; c < channels; c++) {
        const pick = (px, py) => source.data[(py * source.width + px) * channels + c];
        target[at + c] = Math.round(
          pick(x0, y0) * (1 - wx) * (1 - wy) + pick(x1, y0) * wx * (1 - wy) + pick(x0, y1) * (1 - wx) * wy + pick(x1, y1) * wx * wy,
        );
      }
    }
  }
};

const write = async (path, png) => {
  await writeFile(path, PNG.sync.write(png, { colorType: 2, inputColorType: 6, inputHasAlpha: true }));
  console.log(path);
};

const assets = 'ios/App/App/Assets.xcassets';
const icon = new PNG({ width: iconPixels, height: iconPixels });
drawScaled(icon.data, iconPixels, iconPixels, 0, 0);
await write(`${assets}/AppIcon.appiconset/AppIcon-512@2x.png`, icon);

const splash = new PNG({ width: splashPixels, height: splashPixels });
for (let at = 0; at < splash.data.length; at += channels) {
  splash.data.set([...background, 255], at);
}
const inner = Math.round(splashPixels * iconRatio);
const offset = Math.round((splashPixels - inner) / 2);
drawScaled(splash.data, splashPixels, inner, offset, offset);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await write(`${assets}/Splash.imageset/${name}`, splash);
}
