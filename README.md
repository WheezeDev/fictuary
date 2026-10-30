# Fanfic Library

Save AO3 stories to this computer so you can read them even when AO3 is down.

## Starting it

Double-click **Start Fanfic Library.bat**. A black window opens (leave it open) and your
library opens in the browser at http://localhost:4321. Close the black window to stop it.

## Saving a story

1. On AO3, copy the story's link (any chapter link works).
2. Paste it in the box at the top and press **Save**. You can paste several links at once.

If AO3 is down when you paste, the link goes on the **Waiting for AO3** list and saves on its
own once AO3 is back (it tries every 10 minutes while the app is open).

## Organising

- **Your own hashtags**: open a story, click **Details**, type a tag like `#comfort read` and press Enter.
- **Filter**: click any tag in the side list or on a story to show only stories with it. Click
  more tags to narrow further. Click a tag at the top of the list to remove it.
- **Shelves**: To read, Reading, Finished. Opening a story moves it to Reading.
- **New chapters**: open a story, click **Details**, then **Check for new chapters**.
  Your hashtags and notes are kept.
- The app remembers how far you scrolled in each story.

## Where your stories are

Everything is in the `library` folder next to this file: one folder per story with the story
text (`story.html`), an e-book copy (`story.epub`, for phone or e-reader apps), and its
details (`meta.json`). Because this folder is in OneDrive, it is backed up too.

## Things it cannot do (yet)

- Stories that AO3 only shows to logged-in members cannot be saved.
- Series links are not supported; save each story in the series.

## For testing

`test/fake-ao3.js` is a pretend AO3 for trying the app without touching the real site:
run `node test/fake-ao3.js`, then start the app with `AO3_TEST_SITE=http://localhost:4399`.
