# Day 4 Part 2: Radio Bait System

## Mechanic Overview

Players can find portable radios in the cubicles and server rooms. A radio can be armed with a custom text message (up to 30 characters), set on a 3-5 second timer, and either thrown to lure the monster or held until it detonates in the player's hands.

When thrown, the radio broadcasts the message via ElevenLabs TTS (or a static burst fallback) at its landing position. The monster is lured to the radio's location for 5 seconds, giving the player time to escape or reposition.

## Player Flow

1. Walk near a radio-table prop and press E to pick up the radio (max 1 carried).
2. Press R to arm. Game pauses, popup overlay appears.
3. Type a message or select a preset. Adjust the timer (3-5s). Click ARM.
4. Game resumes. TTS API call fires in the background.
5. Press G to throw the radio (parabolic arc forward). Or hold it.
6. Timer expires:
   - If thrown: TTS/fallback plays at radio position, monster lured for 5s.
   - If in hand: +50 suspicion, screen flash, "RADIO MALFUNCTIONED" message.
7. Spent radio remains on floor as visual prop.

## Popup UI

HTML overlay (not PIXI). Positioned fixed over the canvas with z-index 1000. Contains:
- Text input (max 30 chars)
- 4 preset buttons: HELP ME, OVER HERE, AAAAH, STAY BACK
- Timer slider (3-5s, default 4)
- ARM button (disabled until text is non-empty)
- CANCEL button (Esc key also cancels)

## TTS API Integration

- Endpoint: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
- Voice: Adam (pNInz6obpgDQGcFmaJgB), neutral male
- Model: eleven_turbo_v2_5 (low latency)
- Response: audio/mpeg blob, loaded into Howler via blob URL
- Timeout strategy: fire-and-forget at ARM. If not ready by timer expiry, fallback to static_burst.mp3
- AbortController cancels the request if player dies before timer expires.

### Security Warning

The ElevenLabs API key is exposed in the client JavaScript bundle via vite.config.ts `define`. This is intentional for the hackathon demo. For production:
- NEVER ship the API key in the client bundle.
- Use a server-side proxy (Vercel serverless function, etc.).
- Rotate the key after the hackathon.

## Fallback Audio

`static_burst.mp3` is registered in audio-catalog.ts but the actual audio file must be sourced manually. It should be approximately 1-2 seconds of harsh radio static with a brief feedback squeal. Place the file at `assets/audio/static_burst.mp3`.

## Monster Lure Mechanic

When a thrown radio detonates:
- Monster's hunt target is overridden to the radio's world X position.
- Override lasts 5 seconds.
- Monster transitions to HUNT state (forced, bypasses normal transition rules).
- +40 suspicion applied to ensure the monster reacts.
- After 5s, lure expires and monster re-acquires the player.

## Key Bindings

- E: Pick up radio (near radio-table or dropped radio)
- R: Arm carried radio (opens popup, pauses game)
- G: Throw armed radio (during countdown, while in PLAYING phase)
- Esc: Cancel ARM popup
- Enter: Confirm ARM popup

## Radio Locations

- Cubicles room: x=1800, on radio-table decorative prop
- Server room: x=2200, on radio-table decorative prop

## Edge Cases Covered

- Popup open + browser tab loses focus: game stays paused, no API call yet
- ARM then die before timer: TTS cancelled, no audio on dead game
- API failure (network, 401, 429): silent fallback to static_burst
- Howler decode failure: logged, blob cleaned up
- G pressed during popup: popup is modal, input ignored
- G pressed with no armed radio: no-op
- Empty text input: ARM button disabled
- Pick up second radio while carrying first: first dropped at player position
- Room change with armed radio: radio detonates in old room
- Game restart while radio armed: armed radios cleared

## TODO

1. Source `static_burst.mp3` and `radio_throw.mp3` audio assets (run `npm run audio:generate` or add manually).
2. Rotate ElevenLabs API key after hackathon.
3. Consider server-side TTS proxy for production.
