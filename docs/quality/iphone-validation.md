# Real iPhone MVP Validation Checklist

Run this during week one before polishing the Echo UI further. Record each run in `docs/quality/iphone-results.md` with device, iOS version, browser, network, pass/fail, MIME output, and notes.

## Devices And Browsers

- [ ] iPhone Safari tab.
- [ ] Installed home-screen PWA.
- [ ] Chrome on iOS.

## Microphone And Recording

- [ ] First permission grant succeeds.
- [ ] Permission denial shows a recoverable message.
- [ ] MIME support diagnostics are captured.
- [ ] Actual recorded MIME type is captured.
- [ ] Blob size is captured.
- [ ] 10 second recording succeeds.
- [ ] 30 second recording succeeds.
- [ ] 60 second recording auto-stops or blocks overrun.
- [ ] Discard stops tracks and leaves no pending submission.
- [ ] App switch/background behavior is recorded.
- [ ] Reload during recording discards safely and does not create an entry.
- [ ] Reload during processing does not claim audio replay or permanent audio storage.

## Network And Processing

- [ ] Offline before recording blocks the flow.
- [ ] Network drop after recording shows temporary/failed state honestly.
- [ ] Temporary upload succeeds on Wi-Fi.
- [ ] Temporary upload succeeds on cellular.
- [ ] Gemini dev transcription returns usable text for 10s, 30s, and 60s samples.
- [ ] Transcript quality is acceptable enough to understand the reflection without user editing.
- [ ] Cleanup is confirmed: temporary audio is deleted after transcription.
- [ ] Expired temporary audio asks the user to re-record.

## Product Safety

- [ ] UI never offers audio replay in MVP.
- [ ] UI never says original audio is permanently stored.
- [ ] Mirror Note uses cautious language.
- [ ] Mirror Note avoids diagnosis, therapy claims, and certainty about emotions.
- [ ] Memory Card quote is an exact transcript quote.
