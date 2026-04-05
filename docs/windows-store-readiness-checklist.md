# Windows Store Readiness Checklist

Last reviewed: 2026-04-05

This checklist combines current Microsoft Store PWA submission steps with the current state of the ParaBreach workspace.

## Submission Readiness

- [x] Create or sign in to a Partner Center developer account
- [x] Confirm access to the Apps & games or Windows & Xbox publishing area inside Partner Center
- [ ] Reserve the product name `ParaBreach`
- [ ] Decide whether the first release should be `Public audience` or a limited private audience test
- [ ] Run the live URL through PWABuilder and review the report card
- [ ] Generate the Windows package set from PWABuilder
- [ ] Create the first Partner Center submission
- [ ] Upload the generated Windows package files
- [ ] Fill in Store listing text and screenshots
- [ ] Complete age ratings questionnaire
- [ ] Complete pricing and availability
- [ ] Add certification notes if needed
- [ ] Submit for certification

## Repo And App Status

### Ready

- [x] Live HTTPS URL exists: `https://billbaud.github.io/ParaBreach/web/`
- [x] Web app manifest exists
- [x] Service worker exists
- [x] Localhost dev workflow exists via `npm run dev`
- [x] Version metadata is centralized in `web/app-meta.js`
- [x] Store submission docs exist in `docs/`
- [x] Store listing draft copy exists in `docs/store-listing-template.md`

### Still Missing

- [x] Confirm the account is enrolled for Microsoft Store app publishing and not only general Partner Center access
- [ ] Final Store screenshots captured
- [ ] Final review of icon quality for Store listing and package branding
- [ ] PWABuilder package generated from the production URL
- [ ] Partner Center app record created
- [ ] Age rating answers completed in Partner Center
- [ ] Pricing and availability chosen
- [x] Privacy policy URL published
- [ ] Optional support/contact URL decided

## Recommended Partner Center Choices For ParaBreach

- Product type: PWA
- Primary category: Games
- Suggested subcategory: Arcade or Action
- Audience for first upload: Private audience if you want a low-stress certification dry run, otherwise Public audience
- Pricing: Free is the simplest first release path

## Partner Center Navigation Note

If Partner Center opens to `Account settings | Overview`, that confirms the account exists, but it does not by itself confirm Microsoft Store publishing is enabled.

For app submissions, the next thing to look for is the Apps & games or Windows & Xbox area. If you do not see it:

1. Go to `Home` in Partner Center.
2. Look for an `Apps & games` or `Windows & Xbox` tile.
3. If it is missing, use `Enroll in programs` and join the Windows and Xbox program for Store app submissions.
4. After enrollment completes, return to the Apps & games area and create a new product.

## Likely Age Rating Direction

This is an inference, not a Store-issued rating.

- Likely target outcome: `7+` or `12+`
- Why: the game depicts arcade combat and enemy troopers, but there is no gore, explicit injury detail, sexual content, or real-world gambling

The final age rating comes from the IARC questionnaire in Partner Center.

## What We Should Finish Next

1. Capture four good screenshots from the live or localhost build.
2. Decide whether to keep the current icon or produce a stronger Store-specific icon.
3. In Partner Center, select `New product` -> `Game`, then reserve the `ParaBreach` name.
4. Run PWABuilder against the production URL and note any warnings.
5. Paste in the listing copy from `docs/store-listing-template.md`.
