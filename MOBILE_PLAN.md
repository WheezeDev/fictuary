# Fanfic Library on iPhone - plan

Status: plan only, nothing built yet.

## The goal

Keep reading the story you're on when AO3 goes down, on the iPhone, without needing the
computer. Every chapter in one place, with the same library look: AO3 tags, your own
hashtags, shelves, and remembering where you stopped.

## What it is

A web app you add to the iPhone Home Screen. It opens like an app, with its own icon and no
Safari bars. Stories are saved inside the phone, so once a story is added it works with:

- no AO3
- no internet
- the computer switched off

The same app also works on Android.

## Why use it when AO3 is up

It is a companion to AO3, not a replacement. AO3 already has comments, kudos, finding new
stories, and private bookmarks with tags. This app does what AO3 does not:

1. **No signal needed.** Subway, plane, bad Wi-Fi: every chapter is already on the phone.
2. **Your copy survives.** If the author deletes the story, locks it to members, or rewrites
   it, your saved copy stays as it was. This is the main reason, more than outages.
3. **Continue where you stopped.** AO3 remembers which story, not where in it. The app opens
   on the exact paragraph. A **Continue reading** button sits at the top of the library.
4. **Comfortable phone reading.** Proper text size and dark mode, nothing in the way.
5. **A private shelf.** Your own hashtags and notes, visible to no one.

Hashtags are a nice extra on top of the first three.

### Fair to authors

Reading here means authors get fewer hits, kudos and comments, which matter a lot in fandom.

- The end of every story has a **Leave kudos on AO3** button that opens it on AO3.
- The wording is about saving and protecting stories, never "read without AO3".
- No sharing or sending saved stories to anyone.

### Why not a "real" App Store app

Putting your own app on an iPhone needs a Mac to build it, plus either $99 a year to Apple or
reinstalling it every 7 days. The Home Screen web app avoids all of that.

## How you use it

### First time (once)

1. Open the app's web address in Safari.
2. Tap **Share**, then **Add to Home Screen**.
3. From then on, open it from the Home Screen icon.

### Adding a story

1. Open the story on AO3 in Safari.
2. Tap **Download**, then **HTML**. This is AO3's own button and gives you all chapters in one
   file. It saves to the Files app.
3. In Fanfic Library, tap **Add story** and pick that file.
4. The app reads the title, author, summary, word count, chapters and all AO3 tags from the
   file and puts the story in your library.

You can pick several files at once.

### Reading

- Tap a story to read it. Text is sized for the phone, with light and dark mode following the
  phone's setting.
- Your place is remembered for each story.
- Opening a story moves it to the **Reading** shelf.

### Organising

- **Your hashtags**: open a story, tap **Details**, type a tag like `#comfort read`.
- **Filter**: tap **Filter** to open the list of your hashtags, fandoms, ships and AO3 tags.
  Tap tags to narrow down. On the phone this list is folded away so the stories get the screen.
- **Shelves**: To read, Reading, Caught up, Finished.
- **Search** by title, author or tag.

### Where the downloaded stories end up

1. Tapping **Download > HTML** on AO3 puts the file in the Files app, in **Downloads**.
   That is just a delivery copy.
2. **Add story** copies it into the app's own storage on the phone. From then on the app does
   not need the file in Downloads; you can delete it there.
3. The app's storage is not visible in the Files app. That is why **Back up my library** exists:
   it is the only way to see or move your stories outside the app.

To check first when building: that Safari saves AO3's HTML download to Files rather than just
opening it as a page.

### Ongoing stories and new chapters

The app cannot check AO3 by itself (AO3 does not allow that from other websites), so you are
the one who brings in new chapters. The app makes that quick and safe:

- **Knowing there is a new chapter**: subscribe to the story on AO3 (the Subscribe button);
  AO3 emails you when a chapter is posted. The app also shows "last saved 12 days ago" on
  stories still being written.
- **Getting it**: each ongoing story has a **Get latest** button. It opens AO3's download for
  that exact story in Safari, so it is one tap, then **Add story** and pick the file.
- **Adding it**: the app recognises the same story and:
  - replaces the text with the new version,
  - keeps your hashtags, notes, shelf and place,
  - marks it **2 new chapters**,
  - makes **Continue reading** jump to the first new chapter if you had finished the old ones.
- **Your place is kept by chapter, not by percentage**, so new chapters never push you to the
  wrong spot. (The computer version currently uses percentage and should be changed the same
  way.)
- **Protection against bad updates**: if the new file is shorter than your saved copy (author
  deleted chapters or rewrote it), the app asks: **Keep my copy** or **Use the new version**.
  This keeps the "your copy survives" promise.
- **Shelves for ongoing stories**:
  - **Caught up**: you have read every chapter of a story that is still being written. It
    moves here on its own and back to Reading when new chapters arrive.
  - When a story becomes complete (for example 12/12), it is marked **Complete**.

### Backup

- **Back up my library**: saves everything (stories, tags, notes, places) as one file. Keep it
  in iCloud Drive or OneDrive.
- **Restore from backup**: loads that file back, for a new phone or after deleting the app.
- The app gently reminds you to back up if it has been a while.

## Screens

1. **Library**: Continue reading at the top, Add story button, search, Filter button, shelf
   tabs, list of stories (title, author, fandom, words, chapters, new-chapter badge, your
   hashtags, a few AO3 tags).
2. **Filter panel**: slides up over the library; tag lists with counts; Clear button.
3. **Reader**: story text full screen; small top bar with Back, title, and Details.
4. **Details**: your hashtags, notes, shelf, Get latest (ongoing stories), Leave kudos on AO3,
   Remove story.
5. **Settings**: Back up, Restore, text size, how much space is used.

Same compact look as the computer version: small rows, no emoji, no big decorations.

## Where things live

| Thing | Where | Who can see it |
|---|---|---|
| The app itself (screens, no stories) | GitHub Pages on your personal WheezeDev account | Anyone with the link, but it is just an empty app |
| Your stories, tags, notes | Inside the iPhone, in the app's own storage | Only you, on that phone |
| Backups | Wherever you save the backup file | Only you |

The app needs a secure web address to work offline on an iPhone, which is why it is hosted.
Nothing about your stories is sent anywhere. It never uses the work GitHub account.

## Things to know before building

- **No paste-a-link on the iPhone.** AO3 does not let other websites fetch its pages, and this
  app counts as another website. Downloading through AO3's own button is the way around it.
  Making paste-a-link work would need a server in the middle, which AO3 tends to block, so
  this plan leaves it out.
- **Save before AO3 goes down.** It protects stories you have already added, not ones you
  meant to add. For the story you're on, re-download when new chapters come out.
- **Stories live on one phone.** Losing the phone or deleting the app loses them unless you
  have a backup. That is why backup is part of the first version, not an extra.
- **iPhone storage rules.** Apple keeps Home Screen web apps' data, but if the phone runs very
  low on space it may clear it. Another reason for backups.
- **Members-only stories** work here as long as you are logged in to AO3 in Safari when you tap
  Download, since you are downloading them yourself. (The computer version cannot do these.)
- **The computer and the phone are separate.** Stories added on one do not show up on the
  other. Linking them is possible later (for example the computer version making a backup
  file the phone can restore), but not in the first version.

## Publishing step (needs your OK)

Putting the app on GitHub Pages means publishing to your personal GitHub. I will prepare it
and you approve before anything goes online.

## Later, maybe

- Bring stories from the computer version over to the phone through a backup file.
- Series: add every story in a series at once.
- Reading settings: font, line spacing, sepia background.
