# Echo MVP PRD

## Problem Statement

People want a lightweight way to reflect on their day without committing to a full journaling habit. Writing can feel too heavy, but speaking for a minute can feel natural. Echo should test whether a mobile-first voice reflection loop feels valuable: the user opens the app, answers a daily prompt out loud, gets their own words back as text, and receives a gentle reflective note.

The highest-risk assumption is not whether the app can display beautiful reflection screens. The highest-risk assumption is whether mobile browsers, especially iOS Safari, can reliably record short audio, hand it off for transcription, and produce a useful reflection without retaining the original audio.

The MVP must also avoid creating privacy risk too early. Echo should not permanently store original audio in the first version. It should keep only the transcript, generated reflection artifacts, and metadata needed to show history and delete/export user data later.

## Solution

Echo will be a mobile-first web app with PWA-shaped behavior. It will use the exported design bundle as the visual source of truth, specifically the Linen & Sage direction from the provided prototype. The first version will implement a reduced set of screens from the design: onboarding/auth, Today, Recording, Processing, Afterglow/result, and History.

The core MVP promise is:

> Speak for a minute. Echo turns it into words and a gentle reflection. Echo does not keep your original audio after transcription.

Audio may exist temporarily while transcription is being completed. Temporary audio can live in browser memory, short-lived local draft storage, or a private temporary backend storage object, but it must be deleted after transcription succeeds or expires. Long-term audio replay is out of scope for MVP.

The first implementation must prove the audio/transcription loop before polishing the full app. An internal `/audio-lab` screen will validate browser recording, MIME behavior, temporary upload, Gemini transcription, failure modes, and real iPhone behavior.

## User Stories

1. As a new user, I want to understand Echo's promise quickly, so that I know what the app is for.
2. As a new user, I want Echo to explain that it reflects without diagnosing, so that I trust the tone.
3. As a new user, I want to sign in before recording, so that my reflections are tied to my account.
4. As a new user, I want a low-friction email magic-link or OTP sign-in, so that auth does not feel like a corporate login flow.
5. As a signed-in user, I want Echo to capture my timezone, so that daily prompts and history dates make sense.
6. As a signed-in user, I want to see a daily prompt, so that I do not have to decide what to reflect on.
7. As a signed-in user, I want to see a few prompt chips, so that I can choose a prompt that fits my day.
8. As a signed-in user, I want a large record button, so that recording feels obvious on mobile.
9. As a signed-in user, I want recording to be capped at about 60 seconds, so that the habit stays lightweight.
10. As a signed-in user, I want to see recording progress, so that I know how much time is left.
11. As a signed-in user, I want to discard a recording before submission, so that I remain in control.
12. As a signed-in user, I want Echo to prevent recording when the browser cannot access the microphone, so that I get a clear failure instead of a broken experience.
13. As a signed-in user, I want Echo to warn me when I am offline before recording, so that I know transcription cannot happen safely.
14. As a signed-in user, I want Echo to submit my recording for transcription, so that my spoken reflection becomes text.
15. As a signed-in user, I want Echo to keep temporary audio only as long as needed, so that my original voice is not retained.
16. As a signed-in user, I want Echo to tell me when it is still securing the recording, so that I do not close the app too early.
17. As a signed-in user, I want Echo to tell me when it is safe to close the app, so that I can leave while transcription continues.
18. As a signed-in user, I want transcription failure to be clear, so that I know whether I can retry or need to record again.
19. As a signed-in user, I want failed recordings with expired temporary audio to say that the original audio was not kept, so that I understand why re-recording is required.
20. As a signed-in user, I want to see "My Words," so that my spoken reflection comes back to me as text.
21. As a signed-in user, I want a short Mirror Note, so that I receive a gentle reflection without diagnosis or certainty.
22. As a signed-in user, I want mood or theme tags, so that entries are easier to scan later.
23. As a signed-in user, I want a quote-based Memory Card, so that the app gives me a keepsake without inventing new meaning.
24. As a signed-in user, I want the Memory Card to use exact transcript quotes, so that it remains grounded in my actual words.
25. As a signed-in user, I want to delete an entry, so that I control what remains in Echo.
26. As a signed-in user, I want a reflection history, so that I can revisit past entries.
27. As a signed-in user, I want history to show dates, tags, and a short quote, so that I can scan my reflections.
28. As a signed-in user, I want history without audio replay in MVP, so that Echo does not need to retain original voice recordings.
29. As a privacy-conscious user, I want honest privacy copy, so that I understand temporary third-party AI processing during testing.
30. As a privacy-conscious user, I want Echo to avoid saying "only you can hear these" while third-party AI processing is involved, so that the app does not overpromise.
31. As a privacy-conscious user, I want original audio deleted after transcription, so that the riskiest data is not retained.
32. As a future user, I may want opt-in audio retention later, so that I can replay original voice recordings if I explicitly choose that.
33. As a developer, I want future audio fields in the schema now, so that later opt-in audio retention does not require a major rewrite.
34. As a developer, I want Gemini hidden behind provider interfaces, so that we can switch providers before launch if needed.
35. As a developer, I want provider metadata stored per entry, so that transcription and reflection output can be debugged later.
36. As a developer, I want an audio lab route, so that mobile browser recording behavior can be tested independently of the polished UI.
37. As a developer, I want MIME support and actual recorded MIME type visible in audio lab, so that iOS Safari behavior can be validated.
38. As a developer, I want test entries to record transcription status, so that async failures are observable.
39. As a developer, I want temporary audio deletion to be explicit and testable, so that privacy behavior is not assumed.
40. As a founder, I want the first build to validate the risky audio loop before polishing, so that we do not build a beautiful app around an unproven capture flow.

## Implementation Decisions

- The app will be built as a Vite + React + TypeScript mobile-first web app.
- Supabase will provide authentication, database, private temporary storage, and row-level security.
- Gemini free tier may be used for development only. It is not the public production privacy promise.
- Gemini must sit behind provider interfaces:
  - `TranscriptionProvider`
  - `ReflectionProvider`
- The UI must not call Gemini directly. Provider keys and provider calls belong in server-side functions.
- The first route to build is an internal `/audio-lab` route, used to validate browser audio capture and Gemini transcription before the polished app loop.
- The design source of truth is `echo-voice-reflection-app/project/Echo App.dc.html`.
- The canonical visual direction is Linen & Sage from the design bundle.
- The MVP should recreate the selected design screens closely, but only after the audio/transcription loop is proven.
- Desktop layout should be phone-framed. Mobile layout should fill the viewport while preserving the design's proportions as much as possible.
- The MVP screens are onboarding/auth, Today, Recording, Processing, Afterglow/result, and History.
- The following design elements should be preserved: Newsreader and Hanken Grotesk typography, Linen & Sage palette, breathing record orb, soft cards, warm neutral backgrounds, and Afterglow typography.
- The following prototype features must be removed or deferred: audio replay, keep-original-audio setting, audio retention setting, weekly recap, shareable cards, save image, transcript editing, Mirror Note editing, and "make shorter."
- Sign-in is required before recording. Anonymous recording is out of scope.
- The app must capture timezone after auth.
- Echo will not permanently store original audio in MVP.
- Temporary audio is allowed during transcription.
- Temporary audio may live in browser memory, IndexedDB as a short-lived emergency buffer, or private temporary backend storage.
- The backend handoff point should be a private temporary Supabase Storage object when needed for reliability and safe-to-close behavior.
- Temporary audio must be deleted after transcription succeeds or after a short failure TTL.
- The product copy should say "Echo does not keep your original audio after transcription," not "Echo never stores audio."
- The app should only tell the user it is safe to close after the audio has reached the backend temporary store or provider handoff.
- No offline-first promise will be made. The app can be installable, but recording requires network availability for MVP.
- If the user is offline before recording, recording should be disabled or blocked with clear copy.
- If the network drops after recording, the app may keep a short-lived local unsynced draft and clearly tell the user what happened.
- Failed transcription states must distinguish retryable failures from expired temporary audio failures.
- If temporary audio has expired or been deleted, the user must re-record. Echo must not invent a transcript.
- "My Words" is the transcript.
- "Mirror Note" is one short, cautious reflection.
- Mood/theme tags are one to three gentle labels.
- Memory Card in MVP is deterministic UI using an exact quote from the transcript, not a separate AI-generated keepsake.
- No editing in MVP. Users can keep or delete entries.
- Future opt-in audio retention should be possible without rewriting the entry model.

Suggested entry state machine:

```txt
draft_recording
-> recorded_locally
-> uploading_for_transcription
-> transcribing
-> transcribed
-> reflecting
-> ready

recording_failed
upload_failed
transcription_failed_retryable
transcription_failed_expired
reflection_failed
deleted
```

Suggested `entries` model:

```txt
id
user_id
prompt_text
recorded_at
recorded_date
timezone
status
transcript
mirror_note
mood_tags
memory_quote
duration_ms
audio_retention_policy
audio_storage_path
audio_mime_type
audio_size_bytes
audio_deleted_at
transcription_provider
transcription_model
reflection_provider
reflection_model
error_code
error_message
created_at
updated_at
deleted_at
```

For MVP:

```txt
audio_retention_policy = none
audio_storage_path = null after transcription cleanup
audio_deleted_at = set once temporary audio is removed
```

Suggested temporary audio job model:

```txt
id
entry_id
user_id
status
storage_path
mime_type
size_bytes
expires_at
deleted_at
attempts
last_error
created_at
updated_at
```

## Testing Decisions

- Tests should focus on external behavior at the module seams, not implementation details.
- The most important test seam is the entry workflow: given a recorded audio blob and prompt metadata, the system should create an entry, hand off temporary audio, transcribe, delete temporary audio, generate reflection artifacts, and end in the correct status.
- The recording module should be tested with browser capability fakes for permission denied, unsupported MIME type, short recording, max-duration stop, and cancellation.
- Provider interfaces should be tested with fake adapters so app behavior does not depend on live Gemini calls.
- The Gemini adapter should have a small integration test or manual verification script gated by environment variables.
- The reflection generation module should be tested for tone constraints: no diagnosis, no therapy claims, no certainty about emotions, and use of cautious phrases such as "You mentioned," "It seems like," or "One thing that stands out is."
- State transition tests should verify that transcription cannot start before temporary audio handoff succeeds.
- Cleanup tests should verify that temporary audio is deleted after successful transcription.
- Failure tests should verify the difference between retryable transcription failure and expired temporary audio.
- RLS tests or policy checks should verify that users cannot read, update, or delete entries that belong to another user.
- The `/audio-lab` screen must be manually tested on a real iPhone in mobile Safari and Chrome early in the project.
- Real iPhone testing must cover permission grant/deny, MIME support, 10/30/60 second recordings, app switch/background, network drop after recording, upload success, Gemini transcription accuracy, and reload behavior.

## Out of Scope

- Permanent audio storage.
- Audio replay.
- Keep-original-audio setting.
- Audio retention controls.
- Voice archive.
- Anonymous recording.
- Offline-first recording.
- Weekly recap.
- Pattern detection.
- Voice DNA.
- Search My Life.
- Future Self Vault.
- Monthly Wrap.
- Billing.
- B2B.
- Therapist workflows.
- Complex notifications.
- Transcript editing.
- Mirror Note editing.
- AI-generated Memory Card prose.
- Shareable card image export.
- Production provider commitment to Gemini free tier.

## Further Notes

The current repository contains an exported design bundle rather than an implemented app. The design bundle should be treated as visual reference, not production code. The primary source is `Echo App.dc.html`; `Echo Directions.dc.html` documents visual directions and confirms Linen & Sage as the chosen base.

The first engineering milestone should be the audio/Gemini spike. If real iPhone recording and transcription fail, the product should not proceed to polished screens until the capture path is fixed or the product direction changes.

The privacy copy must remain technically honest. During development with Gemini free tier, users should be warned not to record anything they would not want processed by a third-party AI service. Before production launch, provider terms and data retention behavior must be reviewed.
