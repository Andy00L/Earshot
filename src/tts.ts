// src/tts.ts
// Browser-side TTS client. Calls the Vercel serverless proxy at /api/tts.
// The API key is server-side only and never reaches the client bundle.

const VOICE_ADAM = "pNInz6obpgDQGcFmaJgB";

export interface TtsOptions {
  voiceId?: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

/**
 * Call TTS proxy and return a blob URL playable by Howler, or null on failure.
 * Callers should fall back to SFX when null is returned.
 */
export async function synthesizeTTS(
  text: string,
  signal?: AbortSignal,
  options?: TtsOptions,
): Promise<string | null> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceId: options?.voiceId ?? VOICE_ADAM,
        modelId: options?.modelId,
        voiceSettings: options?.voiceSettings,
      }),
      signal,
    });

    if (!response.ok) {
      console.warn(`TTS proxy returned ${response.status}`);
      return null;
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return null;
    }
    console.warn("TTS proxy request failed", err);
    return null;
  }
}
