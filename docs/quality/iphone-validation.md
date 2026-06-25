# Real iPhone MVP Validation Checklist

Run this during week one before polishing the Echo UI further.

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

## Network And Processing

- [ ] Offline before recording blocks the flow.
- [ ] Network drop after recording shows temporary/failed state honestly.
- [ ] Temporary upload succeeds on Wi-Fi.
- [ ] Temporary upload succeeds on cellular.
- [ ] Gemini dev transcription returns usable text.
- [ ] Temporary audio is deleted after transcription.
- [ ] Expired temporary audio asks the user to re-record.

## Product Safety

- [ ] UI never offers audio replay in MVP.
- [ ] UI never says original audio is permanently stored.
- [ ] Mirror Note uses cautious language.
- [ ] Mirror Note avoids diagnosis, therapy claims, and certainty about emotions.
- [ ] Memory Card quote is an exact transcript quote.
