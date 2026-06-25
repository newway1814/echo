# Echo Domain Context

Echo is a mobile-first web app for voice-first self-reflection. The product idea is "a mirror that remembers," but the MVP is intentionally narrower than a full journaling app.

## Core Promise

Speak for a minute. Echo turns it into words and a gentle reflection. Echo does not keep your original audio after transcription.

## MVP Loop

```txt
User opens app
-> signs in
-> sees daily prompt
-> records 30-60 seconds
-> temporary audio is transcribed
-> original audio is deleted
-> Echo shows My Words, Mirror Note, tags, and a quote-based Memory Card
-> user can view history or delete entries
```

## Glossary

- **Reflection**: One user-created entry based on a short spoken response to a prompt.
- **Daily Prompt**: The prompt shown to the user for the current day.
- **Prompt Chip**: A selectable alternate prompt on the Today screen.
- **My Words**: The transcript generated from the user's spoken reflection.
- **Mirror Note**: A short, cautious AI-generated reflection based on the transcript.
- **Mood Tags**: One to three gentle labels used to summarize the entry for scanning and history.
- **Memory Card**: A visual keepsake based on an exact quote from the transcript, not a separate AI-written artifact in MVP.
- **Temporary Audio**: Audio retained only long enough to complete transcription, then deleted.
- **Audio Retention Policy**: The entry-level setting that records whether original audio is not retained, temporary only, or retained in a future opt-in version.
- **Audio Lab**: An internal diagnostic route used to validate browser recording, MIME behavior, upload, transcription, and cleanup before the polished app flow.
- **Entry Workflow**: The backend/client workflow that moves a reflection from recording through transcription, reflection generation, cleanup, and ready state.

## Locked Decisions

- Build a mobile-first web app with PWA-shaped behavior.
- Use Vite, React, and TypeScript.
- Use Supabase for auth, database, private temporary storage, and RLS.
- Require sign-in before recording.
- Capture timezone.
- Use Gemini free tier for development only.
- Keep Gemini behind replaceable provider interfaces.
- Do not permanently store original audio in MVP.
- Allow temporary audio during transcription.
- Delete temporary audio after transcription succeeds or expires.
- Do not provide audio replay in MVP.
- Include nullable future audio fields in the schema so opt-in audio retention can be added later.
- No weekly recap in MVP.
- No editing in MVP; delete only.
- Memory Card is quote-based, using actual transcript text.
- Mirror Note must be cautious, reflective, and non-diagnostic.

## Design Source Of Truth

The current repo contains a design handoff bundle rather than an implemented app:

```txt
echo-voice-reflection-app/
  README.md
  project/
    Echo App.dc.html
    Echo Directions.dc.html
    support.js
    screenshots/
      directions.png
```

Use `Echo App.dc.html` as the primary visual reference. Use the Linen & Sage visual direction.

## MVP Screens

- Onboarding/auth.
- Today.
- Recording.
- Processing.
- Afterglow/result.
- History.

## Deferred

- Permanent audio storage.
- Audio replay.
- Keep-original-audio setting.
- Audio retention controls.
- Weekly recap.
- Transcript editing.
- Mirror Note editing.
- AI-generated Memory Card prose.
- Shareable card image export.
- Production commitment to Gemini free tier.

## Entry Lifecycle

```txt
draft_recording
-> recorded_locally
-> uploading_for_transcription
-> transcribing
-> transcribed
-> reflecting
-> ready
```

Failure states:

```txt
recording_failed
upload_failed
transcription_failed_retryable
transcription_failed_expired
reflection_failed
deleted
```

The UI may only say "you can close this" after temporary audio has reached backend storage or the provider handoff point.

## First Build Tickets

1. Create app scaffold and design system.
2. Build `/audio-lab` recording and Gemini transcription spike.
3. Build Supabase auth/schema/storage/RLS foundation.
4. Implement core record -> temporary upload -> transcribe -> delete temp audio -> reflect workflow.
5. Implement pixel-faithful MVP screens.

