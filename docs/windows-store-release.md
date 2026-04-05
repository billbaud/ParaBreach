# Windows Store Release

This repo is set up to ship ParaBreach as a Progressive Web App packaged for the Microsoft Store.

## Current Release URL

`https://billbaud.github.io/ParaBreach/web/`

## Local Validation

1. Run `npm install`
2. Run `npm run dev`
3. Open `http://127.0.0.1:4173`
4. Confirm:
   - the game loads without console errors
   - the service worker registers
   - the app works after a reload with the network disabled
   - the manifest is detected by browser devtools

## PWABuilder

1. Open `https://www.pwabuilder.com/`
2. Enter the live release URL
3. Review the report card and resolve any remaining issues
4. Generate the Windows package after reserving the app name in Partner Center
5. Download the generated package set and archive it with the submission notes

## Partner Center

1. Create a Windows developer account in Partner Center
2. Reserve the `ParaBreach` product name
3. Create a new app submission
4. Upload the generated Windows package
5. Fill out the Store listing using `docs/store-listing-template.md`
6. Add screenshots and any optional listing art
7. Complete age ratings, pricing, category, and submission notes
8. Submit for certification

## Important Rules

- Normal HTML, CSS, JavaScript, and asset updates can ship from the hosted web app without rebuilding the Store package.
- Manifest changes require a new Store package and a new submission.
- Keep the live URL stable after Store submission.

## Pre-Submission Checklist

- [ ] `npm install`
- [ ] `npm run dev`
- [ ] Test mouse input on Windows desktop
- [ ] Test touch input on a touch device if possible
- [ ] Confirm app launch, restart, and game-over flows
- [ ] Confirm high score storage works
- [ ] Confirm offline reload works after first visit
- [ ] Capture final Store screenshots
- [ ] Run the live URL through PWABuilder
- [ ] Generate final Microsoft Store package
- [ ] Complete Partner Center submission
