// Regenerates the PWA / favicon assets from the brand logo SVG.
//   Run: node scripts/generate-icons.mjs <path-to-logo.svg>
//
// Two distinct looks:
//  - PWA / home-screen icons: white logo on a softened-black rounded square.
//  - Web favicon + in-app logo: the logo in its own color on a transparent
//    background (no black box).
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/generate-icons.mjs <logo.svg>");
  process.exit(1);
}

// Softened near-black (not pure #000), matching the dark theme background
const BG = "#0f0f14";

/**
 * Render the logo at `inner = size*(1-2*padding)`. When `white` is set, the
 * logo is recolored to solid white using its own alpha as a mask (so a
 * single-color mark reads clearly on black).
 */
async function renderLogo(size, padding, white) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = sharp(src, { density: 512 })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha();

  if (!white) return { buf: await logo.png().toBuffer(), inner };

  const rgba = await logo.png().toBuffer();
  const alpha = await sharp(rgba).extractChannel(3).toColourspace("b-w").toBuffer();
  const buf = await sharp({
    create: {
      width: inner,
      height: inner,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return { buf, inner };
}

async function makeIcon(size, { radius = 0, padding, bg = "black", white = false, out }) {
  const { buf: logo, inner } = await renderLogo(size, padding, white);
  const offset = Math.round((size - inner) / 2);

  const base =
    bg === "transparent"
      ? sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
      : sharp(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
              `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BG}"/></svg>`
          )
        );

  const png = await base
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toBuffer();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log("wrote", out);
}

const r = (size) => Math.round(size * 0.2);
// Bigger logo inside the PWA tiles; roomier padding only for the maskable safe zone
const PWA_PAD = 0.1;
const MASK_PAD = 0.16;
const FAVICON_PAD = 0.06;

await Promise.all([
  // PWA / home-screen: white logo on black rounded square
  makeIcon(192, { radius: r(192), padding: PWA_PAD, white: true, out: join(root, "public/icons/icon-192.png") }),
  makeIcon(512, { radius: r(512), padding: PWA_PAD, white: true, out: join(root, "public/icons/icon-512.png") }),
  makeIcon(180, { radius: r(180), padding: PWA_PAD, white: true, out: join(root, "public/icons/apple-icon.png") }),
  makeIcon(180, { radius: r(180), padding: PWA_PAD, white: true, out: join(root, "app/apple-icon.png") }),
  // Maskable: full-bleed black square, white logo, larger safe zone
  makeIcon(512, { radius: 0, padding: MASK_PAD, white: true, out: join(root, "public/icons/icon-maskable-512.png") }),
  // Web favicon (browser tab): logo only, transparent, no black box
  makeIcon(512, { bg: "transparent", padding: FAVICON_PAD, out: join(root, "app/icon.png") }),
  // In-app brand mark: logo only, transparent
  makeIcon(512, { bg: "transparent", padding: FAVICON_PAD, out: join(root, "public/logo.png") }),
]);

console.log("done");
