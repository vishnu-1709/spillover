// SPILLOVER site settings: edit these, nothing else needs to change.
window.SPILLOVER = {
  // Shown next to the download button.
  version: "1.0.0-beta",
  apkSize: "",          // e.g. "52 MB" — leave empty to hide
  minAndroid: "",       // e.g. "Android 7.0 or newer" — check your export settings, leave empty to hide

  // Upload the APK to a GitHub Release with this exact file name
  // and this link always points at the newest one.
  apkUrl: "https://github.com/vishnu-1709/spillover/releases/latest/download/spillover-beta.apk",

  // Your live site address (after deploying). Used for the QR code.
  // Leave empty to use whatever address the page is opened at.
  siteUrl: "",

  // Google Apps Script web app URL that saves sign-ups and feedback
  // to your Google Sheet. See README → "Connect the forms".
  formEndpoint: "",

  // When the game is live on Google Play, paste the store link here
  // and the page switches its wording automatically.
  playStoreUrl: "",

  // Gameplay clips. Put the files in /clips and list them here.
  // { src: "clips/bomb.mp4", poster: "clips/bomb.jpg", caption: "Bomb mode, 4 phones" }
  clips: []
};
