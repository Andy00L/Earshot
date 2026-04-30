import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { AUDIO_CATALOG, AudioAsset, AudioId } from "../src/audio-catalog";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "assets", "audio");

// Voice ID for radio operator TTS. Replace with a different voice if desired.
const RADIO_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes("--list");
  const force = args.includes("--force");
  const onlyIdx = args.indexOf("--only");
  const onlyId = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  const targets: AudioAsset[] = onlyId
    ? onlyId.split(",").map((id) => AUDIO_CATALOG[id.trim() as AudioId]).filter(Boolean)
    : Object.values(AUDIO_CATALOG);

  if (listOnly) {
    for (const asset of targets) {
      console.log(`${asset.id} [${asset.category}] - ${asset.prompt.slice(0, 80)}`);
    }
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    console.error("ERROR: Set ELEVENLABS_API_KEY in .env (not 'your_key_here')");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of targets) {
    const outPath = join(OUT_DIR, `${asset.id}.mp3`);
    if (!force && (await fileExists(outPath))) {
      console.log(`SKIP ${asset.id} (exists; use --force to regenerate)`);
      skipped++;
      continue;
    }

    console.log(`GENERATE ${asset.id} [${asset.category}]...`);
    try {
      const buffer = await generate(asset);
      await writeFile(outPath, buffer);
      console.log(`  saved ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
      generated++;
    } catch (err: any) {
      if (err.statusCode === 401) {
        console.error(`  AUTH ERROR for ${asset.id}: API key rejected`);
      } else if (err.statusCode === 429) {
        console.error(`  RATE LIMIT for ${asset.id}: try again later`);
      } else if (err.statusCode === 400) {
        console.error(`  BAD REQUEST for ${asset.id}: ${err.message}`);
      } else {
        console.error(`  GENERATE FAILED for ${asset.id}: ${err.message || err}`);
      }
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`);
}

let client: ElevenLabsClient;

function getClient(): ElevenLabsClient {
  if (!client) {
    const apiKey = process.env.ELEVENLABS_API_KEY!;
    client = new ElevenLabsClient({ apiKey });
  }
  return client;
}

async function generate(asset: AudioAsset): Promise<Buffer> {
  const c = getClient();
  if (asset.isMusic) {
    const stream = await c.music.compose({
      prompt: asset.prompt,
      musicLengthMs: 30000,
    });
    return await streamToBuffer(stream);
  }
  if (asset.category === "radio_voice") {
    const stream = await c.textToSpeech.convert(RADIO_VOICE_ID, {
      text: asset.prompt,
      modelId: "eleven_v3",
      outputFormat: "mp3_44100_128",
    });
    return await streamToBuffer(stream);
  }
  if (asset.category === "whisperer_voice" || asset.category === "lore_tape") {
    const voiceId = asset.voiceId ?? "EXAVITQu4vr4xnSDxMaL";
    const modelId = asset.modelId ?? "eleven_turbo_v2_5";
    const vs = asset.voiceSettings;
    const stream = await c.textToSpeech.convert(voiceId, {
      text: asset.prompt,
      modelId,
      outputFormat: "mp3_44100_128",
      voiceSettings: vs ? {
        stability: vs.stability,
        similarityBoost: vs.similarity_boost,
        style: vs.style,
        useSpeakerBoost: vs.use_speaker_boost,
      } : undefined,
    });
    return await streamToBuffer(stream);
  }
  // Sound Effects API (monster vocals + SFX)
  const stream = await c.textToSoundEffects.convert({
    text: asset.prompt,
    durationSeconds: asset.durationSec,
    promptInfluence: 0.7,
  });
  return await streamToBuffer(stream);
}

async function streamToBuffer(
  stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  if (Symbol.asyncIterator in (stream as any)) {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
  } else {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
