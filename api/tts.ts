// api/tts.ts
// Vercel serverless function. Forwards TTS requests to ElevenLabs with
// server-side API key. The key never reaches the client.
//
// Local dev:
//   npm run dev    -> this function does not run; radio bait falls back to SFX
//   npx vercel dev -> Vite + serverless on the same port; radio bait works fully

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

// Allowed voices. Restricts the proxy to voices Earshot actually uses.
// Prevents abuse if someone discovers the endpoint and tries arbitrary voices.
const ALLOWED_VOICES: ReadonlySet<string> = new Set([
  "pNInz6obpgDQGcFmaJgB", // Adam (radio bait, lore tapes, intro narration)
  "EXAVITQu4vr4xnSDxMaL", // Bella (Whisperer voice)
]);

const MAX_TEXT_LEN = 200; // Radio popup caps at 30 chars; 200 is a generous safety margin.

interface TtsRequestBody {
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body: TtsRequestBody;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { text, voiceId, modelId, voiceSettings } = body;

    if (typeof text !== "string" || text.length === 0) {
      return new Response("Missing or empty text", { status: 400 });
    }
    if (text.length > MAX_TEXT_LEN) {
      return new Response(`Text too long (max ${MAX_TEXT_LEN})`, { status: 400 });
    }
    if (typeof voiceId !== "string" || !ALLOWED_VOICES.has(voiceId)) {
      return new Response("voiceId not allowed", { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY env var not set on Vercel");
      return new Response("Server misconfigured", { status: 500 });
    }

    const upstreamController = new AbortController();
    const timeoutId = setTimeout(() => upstreamController.abort(), 8000);

    let elevenRes: Response;
    try {
      elevenRes = await fetch(`${ELEVENLABS_BASE}/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId ?? "eleven_turbo_v2_5",
          voice_settings: voiceSettings ?? {
            stability: 0.4,
            similarity_boost: 0.7,
            style: 0.6,
            use_speaker_boost: true,
          },
        }),
        signal: upstreamController.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if ((err as Error).name === "AbortError") {
        console.error("ElevenLabs request timed out after 8s");
        return new Response("Upstream timeout", { status: 504 });
      }
      console.error("ElevenLabs fetch failed:", (err as Error).message);
      return new Response("Upstream network error", { status: 502 });
    }
    clearTimeout(timeoutId);

    if (elevenRes.status === 401) {
      console.error("ElevenLabs returned 401. Key may be invalid.");
      return new Response("Upstream auth failed", { status: 502 });
    }
    if (elevenRes.status === 429) {
      return new Response("Upstream rate limited", { status: 429 });
    }
    if (!elevenRes.ok) {
      console.error(`ElevenLabs returned ${elevenRes.status}`);
      return new Response(`Upstream error ${elevenRes.status}`, { status: 502 });
    }

    // Forward the audio blob with appropriate headers.
    return new Response(elevenRes.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  },
};
