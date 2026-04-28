import { Assets, Texture } from 'pixi.js';

interface FrameMeta {
  file: string;
  width: number;
  height: number;
  baselineY?: number;
  sourceAtlas?: string;
}

interface CharacterEntry {
  type: 'character';
  frames: Record<string, FrameMeta>;
  boundingBox: { width: number; height: number };
}

interface SingleEntry {
  type: 'single';
  file: string;
  width: number;
  height: number;
}

interface TilesetEntry {
  type: 'tileset';
  tiles: Record<string, FrameMeta>;
  cols: number;
  rows: number;
}

export type ManifestEntry = CharacterEntry | SingleEntry | TilesetEntry;
export type Manifest = Record<string, ManifestEntry>;

function stripAssetsPrefix(filePath: string): string {
  return filePath.startsWith('assets/') ? filePath.slice(7) : filePath;
}

export async function loadGameAssets(
  onProgress?: (progress: number) => void,
): Promise<Manifest> {
  const response = await fetch('/atlas.json');
  if (!response.ok) {
    const msg = `Failed to load atlas.json: ${response.status} ${response.statusText}`;
    console.error(msg);
    throw new Error(msg);
  }

  const manifest: Manifest = await response.json();
  const aliases: string[] = [];

  for (const [entityName, entry] of Object.entries(manifest)) {
    if (entry.type === 'character') {
      for (const [frameName, frameMeta] of Object.entries(entry.frames)) {
        const alias = `${entityName}:${frameName}`;
        const src = '/' + stripAssetsPrefix(frameMeta.file);
        Assets.add({ alias, src });
        aliases.push(alias);
      }
    } else if (entry.type === 'single') {
      const src = '/' + stripAssetsPrefix(entry.file);
      Assets.add({ alias: entityName, src });
      aliases.push(entityName);
    } else if (entry.type === 'tileset') {
      for (const [tileName, tileMeta] of Object.entries(entry.tiles)) {
        const alias = `${entityName}:${tileName}`;
        const src = '/' + stripAssetsPrefix(tileMeta.file);
        Assets.add({ alias, src });
        aliases.push(alias);
      }
    }
  }

  // Intro panels (not in atlas.json, loaded directly)
  const introPanels = ['panel-1', 'panel-2', 'panel-3'];
  for (const panel of introPanels) {
    const alias = `intro:${panel}`;
    Assets.add({ alias, src: `/intro/intro-${panel}.png` });
    aliases.push(alias);
  }

  await Assets.load(aliases, onProgress);
  return manifest;
}

export function getFrameTexture(manifest: Manifest, entity: string, frame: string): Texture {
  const alias = `${entity}:${frame}`;
  const texture = Assets.get<Texture>(alias);
  if (!texture) {
    console.warn(`Texture not found for alias "${alias}", using fallback`);
    return Texture.WHITE;
  }
  return texture;
}

export function getFrameMeta(
  manifest: Manifest,
  entity: string,
  frame: string,
): { width: number; height: number; baselineY: number } {
  const entry = manifest[entity];
  if (!entry || entry.type !== 'character') {
    return { width: 1, height: 1, baselineY: 1 };
  }
  const meta = entry.frames[frame];
  if (!meta) {
    return { width: 1, height: 1, baselineY: 1 };
  }
  return {
    width: meta.width,
    height: meta.height,
    baselineY: meta.baselineY ?? meta.height,
  };
}
