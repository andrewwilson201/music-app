// The parts of the Firebase JS SDK the app uses, bundled into vendor/firebase.js
// so the site needs no CDN or build step. To rebuild (e.g. to update Firebase):
//   npm i firebase esbuild
//   npx esbuild tools/firebase-entry.js --bundle --format=esm --minify --target=es2020 \
//     --legal-comments=none --outfile=vendor/firebase.js
export { initializeApp } from 'firebase/app';
export { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, connectAuthEmulator } from 'firebase/auth';
export { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch, serverTimestamp, connectFirestoreEmulator } from 'firebase/firestore';
export { getMessaging, getToken, deleteToken, isSupported as messagingSupported } from 'firebase/messaging';
export { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
