A horror game where your microphone is the controller.

# Earshot

Five rooms. Three monsters. One way out. Your voice powers the flashlight, but every sound draws the creatures closer.

![Earshot](docs/demo.png)

## How it works

Speak to see. Your mic feeds a beacon meter that drives the flashlight radius. Go silent and the light dies. Shout and the Listener starts hunting.

Three monsters share the building. The Listener patrols by sound. Jumpers ambush from ceiling and floor vents. The Whisperer drains your light with eerie voice lines from ElevenLabs.

Pick up a radio, type a message, throw. ElevenLabs synthesizes your text into speech in real time, luring the Listener to the landing spot.

Find three broken tapes scattered across the building. Bring each to the station in Reception. Reconstruct it by ear (reorder four shuffled audio fragments) to unlock map intel and a final challenge.

Hold SHIFT to run. Faster, louder. Hold CTRL to crouch. Slower, quieter. Speed or stealth, pick one.

## Run locally

```bash
npm install
cp .env.example .env
# add your ELEVENLABS_API_KEY
npm run dev
```

Open http://localhost:5173. Allow microphone access.

Radio bait falls back to a static SFX in dev mode. For live TTS, run `npx vercel dev` instead.

## Stack

- [Pixi.js](https://pixijs.com/) for 2D rendering
- [Howler.js](https://howlerjs.com/) and Web Audio API for sound
- [ElevenLabs](https://elevenlabs.io) for TTS, sound effects, and music

## Docs

- [Architecture](ARCHITECTURE.md)
- [Changelog](docs/CHANGELOG.md)
- [Build journal](docs/journal/)

## Built for

Solo build for [#ElevenHacks](https://elevenhacks.com) (April 2026), the [ElevenLabs](https://elevenlabs.io) x [Zed](https://zed.dev) game jam.
[@elevenlabsio](https://x.com/elevenlabsio) [@zeddotdev](https://x.com/zeddotdev)
