# Domain Docs

This repo uses a single-context domain-doc layout.

## Before Exploring, Read These

- `CONTEXT.md` at the repo root.
- Relevant ADRs under `docs/adr/`.

If a file does not exist yet, proceed silently. Do not block work just because an ADR has not been written.

## File Structure

```txt
/
|-- CONTEXT.md
|-- docs/
|   |-- adr/
|   `-- agents/
`-- src/
```

## Use The Glossary's Vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the terms defined in `CONTEXT.md`.

If a needed concept is missing from the glossary, note the gap or use the domain-modeling skill when the work is specifically about clarifying language.

## Flag ADR Conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it.

