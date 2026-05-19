import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let db: any;
let auth: any;

async function initFirebase() {
  try {
    // We use a dynamic import to prevent lint/build errors when the config is missing.
    // @ts-ignore
    const firebaseConfig = (await import('../../firebase-applet-config.json')).default;
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.warn("Firebase configuration not found or invalid. SmartParent is running in demo mode.");
  }
}

initFirebase();

export { db, auth };
