# Translation status

`src/testing/i18n-files.spec.ts` (I18-003) reads the two lists below. Every key of `en.json` exists in all seven files of `src/assets/i18n/`. A milestone that adds a string adds it to `en` and `de`, and puts the English text under the same key into every file listed as a copy.

| Language | State |
|---|---|
| en | source |
| de | drafted by the agent in V2-M5 S3 (formal "Sie"), **owner review pending** |
| es, fr, it, pt-BR, nl | copy of English, translated in V2-M16 |

## Copies of English

Files that are still whole copies of `en.json`. V2-M16 must empty this list.

- `es`
- `fr`
- `it`
- `pt-BR`
- `nl`

## Same as English by design

Keys whose value may equal the English one in a translated file. This list is permanent; the test fails when an entry is no longer needed. A final `*` stands for any ending.

- `app.placeholder` (empty)
- `settings.language.names.*` (every language is shown under its own name)
- `a11y.versionInfo` (German "Version")
- `tooltip.versionInfo` (German "Version")
