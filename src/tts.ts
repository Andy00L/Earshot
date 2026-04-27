// SECURITY WARNING: The API key is embedded in the client bundle. This is
// acceptable for a hackathon demo ONLY. For production, proxy TTS requests
// through a server-side endpoint. Rotate this key after the hackathon.

declare const __ELEVENLABS_API_KEY__: string;

const VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam (neutral male)
const MODEL_ID = "eleven_turbo_v2_5";     // low-latency model
const API_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

export interface TTSResult {
  blobUrl: string;
}

/**
 * Call ElevenLabs TTS API and return a blob URL playable by Howler.
 * Throws on network error, non-OK status, or abort.
 */
export async function synthesizeTTS(
  text: string,
  signal?: AbortSignal,
): Promise<TTSResult> {
  const apiKey = __ELEVENLABS_API_KEY__;
  if (!apiKey) {
    throw new Error("ElevenLabs API key not configured in build");
  }

  const response = await fetch(`${API_BASE}/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.7,
        style: 0.6,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    if (response.status === 401) {
      throw new Error("TTS auth failed. Check ELEVENLABS_API_KEY in .env.");
    }
    if (response.status === 422) {
      throw new Error(`TTS rejected input: ${errorText.slice(0, 100)}`);
    }
    if (response.status === 429) {
      throw new Error("TTS rate limited. Wait before next radio bait.");
    }
    if (response.status >= 500) {
      throw new Error(`TTS service error (${response.status}). Try again.`);
    }
    throw new Error(`TTS unexpected status ${response.status}: ${errorText.slice(0, 100)}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl };
}
