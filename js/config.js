// Spotify app Client ID from https://developer.spotify.com/dashboard
// (public by design; the PKCE login flow needs no client secret).
export const SPOTIFY_CLIENT_ID = '2da405d7d07c4de89fc81876723f7a86';

// Firebase web app config, from Firebase console › Project settings › Your apps.
// These values are public by design: access is controlled by Firebase Auth and
// the Firestore security rules in firestore.rules, not by keeping this secret.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAnee9ws_5Q7-fU2nZlI4gScRAOLMOe4kY',
  authDomain: 'music-app-d0f3f.firebaseapp.com',
  projectId: 'music-app-d0f3f',
  storageBucket: 'music-app-d0f3f.firebasestorage.app',
  messagingSenderId: '663276465325',
  appId: '1:663276465325:web:ceb91545e2a8dc491f6a24',
};

// Web push key for notifications, from Firebase console › Project settings ›
// Cloud Messaging › Web Push certificates (the public "Key pair"). Public by
// design. Empty hides the notifications switch.
export const FIREBASE_VAPID_KEY = 'BMMFCh344N09A5eiirGFSQOylA_VeLuDUe00kgFdZ277ZsAGmeEm5kyvUVc6ufULD0D1uHPYpT6_zA1h6GXBF00';

// Last.fm API key, for mood tags in "Pick for me" (free, from
// https://www.last.fm/api/account/create). Public by design: it only reads
// public tag data. Empty uses MusicBrainz tags instead, which need no key.
export const LASTFM_API_KEY = '';
