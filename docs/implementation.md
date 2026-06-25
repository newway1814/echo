# Echo MVP Implementation Notes

## Environment

Required client environment variables:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Required server/function environment variables:

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash
GEMINI_REFLECTION_MODEL=gemini-2.5-flash
```

Gemini free tier is for development only. Do not use it as the public production privacy promise for intimate reflections.

## Temporary Audio

Echo MVP does not retain original audio. Temporary audio may exist only long enough to complete transcription. The backend should delete temporary audio after transcription succeeds or after a short failure TTL.

## Local Commands

```txt
npm install
npm run dev
npm test
npm run build
```
