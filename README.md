# SPILLOVER — launch site

The website for SPILLOVER: a landing page with a playable two-phone demo, the beta download with install steps and a QR code, and a tester page with Google Play test sign-up and feedback forms.

Plain HTML, CSS and JavaScript. No build step, no framework.

```
index.html          landing page
tester.html         Google Play test sign-up + feedback
config.js           ← the only file you normally edit
assets/css/site.css
assets/js/          demo.js (the playable demo), site.js, forms.js, ships.js, qrcode.js
assets/fonts/       Space Grotesk (self-hosted)
assets/img/         icon.svg (favicon), og.png (link preview)
clips/              put gameplay videos here
apps-script/Code.gs saves form entries into a Google Sheet
vercel.json
```

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy on Vercel

1. Go to vercel.com, sign in with GitHub, and click **Add New → Project**.
2. Pick the `spillover` repo. Framework preset: **Other**. Leave the build command and output directory empty.
3. Click **Deploy**. Every push to `main` updates the site from then on.
4. Copy the live address (for example `https://spillover.vercel.app`) into `siteUrl` in `config.js`. The QR code uses it.

## Publish a beta APK

The download button points at the newest GitHub Release, so you never edit the link.

1. On GitHub: **Releases → Draft a new release**.
2. Tag it with the version, e.g. `v1.0.0-beta`.
3. Attach the APK and name the file exactly **`spillover-beta.apk`**.
4. Publish. Then update `version` (and `apkSize` if you want it shown) in `config.js`.

Always sign every build with the same release keystore, so new versions install over old ones and players keep their progress.

## Connect the forms (5 minutes)

Sign-ups and feedback are saved into a Google Sheet you own.

1. Create a new Google Sheet (e.g. "SPILLOVER testers").
2. In the sheet: **Extensions → Apps Script**. Delete what's there and paste in everything from `apps-script/Code.gs`. Save.
3. Click **Deploy → New deployment**, choose type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, allow the permissions, and copy the **Web app URL**.
5. Paste it into `formEndpoint` in `config.js` and push.

New sign-ups appear in a "Testers" tab and feedback in a "Feedback" tab. The same email is never added twice. When you're ready for the Google Play closed test, copy the Testers email column into the tester list in Play Console.

Until `formEndpoint` is set, the forms tell people sign-ups aren't connected yet.

## Add gameplay clips

1. Record short clips (10–20 s, phones on a table, landscape). Keep each under about 10 MB: export as MP4 (H.264), 1280×720.
2. Put them in `clips/`, with an optional poster image for each.
3. List them in `config.js`:

```js
clips: [
  { src: "clips/bomb.mp4", poster: "clips/bomb.jpg", caption: "Bomb mode with 4 phones" }
]
```

The "Watch it played" section appears by itself once there's at least one clip.

## When the game is on Google Play

Paste the store link into `playStoreUrl` in `config.js`. The main button becomes "Get it on Google Play" and the wording updates.

## Before launch, check

- [ ] `siteUrl`, `version`, `formEndpoint` set in `config.js`
- [ ] A release exists with `spillover-beta.apk`, and the download button works on a phone
- [ ] A test sign-up shows up in the Sheet
- [ ] The QR code (desktop only) opens the page on your phone
- [ ] `minAndroid` filled in once you've confirmed the minimum version from your Godot export settings
