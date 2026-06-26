# Echo

Echo is a mobile-first web app for voice-first self-reflection. The MVP tests one loop: speak for about a minute, transcribe temporary audio, delete the original audio, and return My Words, a cautious Mirror Note, Mood Tags, and a quote-based Memory Card.

## Current MVP Scope

- Vite + React + TypeScript mobile web app.
- Linen & Sage visual system based on the design bundle in `echo-voice-reflection-app/`.
- Internal Audio Lab route for browser recording diagnostics.
- Provider seams for transcription and reflection.
- Supabase schema for auth-owned reflections and temporary audio jobs.
- No permanent audio storage or audio replay in MVP.

## Commands

```txt
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## MVP Quality Gates

Before sending Echo to testers, run the automated gates above and then complete `docs/quality/iphone-validation.md` on a real iPhone. Record real-device results in `docs/quality/iphone-results.md`; desktop automation cannot prove iOS Safari recording, PWA microphone behavior, MIME output, background handling, or cleanup under network interruption.

## Important Privacy Copy

Echo should say:

> Echo does not keep your original audio after transcription.

Echo should not say:

- "Only you can hear these."
- "Echo never stores audio."
- "Echo never trains on your reflections." unless the production provider terms support it.

## Design Source

Use `echo-voice-reflection-app/project/Echo App.dc.html` as the primary visual reference. The canonical visual direction is Linen & Sage.

## Real iPhone Testing

Before polishing beyond MVP, run the checklist in `docs/quality/iphone-validation.md` on a real iPhone in Safari, installed PWA mode, and Chrome on iOS.
