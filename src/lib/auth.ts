import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export const OWNER_EMAIL = 'zainchamp5@gmail.com';

// Standard Google Auth provider: only basic profile & email.
// NO sensitive scopes here -> eliminates "Google hasn't verified this app" warning!
const basicProvider = new GoogleAuthProvider();
basicProvider.setCustomParameters({
  prompt: 'select_account',
});

// Dedicated workspace provider for Owner requesting Gmail reminders
export const getWorkspaceProvider = () => {
  const wsProvider = new GoogleAuthProvider();
  wsProvider.addScope('https://www.googleapis.com/auth/gmail.send');
  wsProvider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline',
  });
  return wsProvider;
};

// Cache the access token in memory & sessionStorage so reloads retain authorization
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem('hisaab_oauth_token') : null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') sessionStorage.removeItem('hisaab_oauth_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (requestWorkspaceScopes = false): Promise<{
  user: User;
  accessToken: string | null;
} | null> => {
  try {
    isSigningIn = true;
    const providerToUse = requestWorkspaceScopes ? getWorkspaceProvider() : basicProvider;
    const result = await signInWithPopup(auth, providerToUse);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('hisaab_oauth_token', credential.accessToken);
      }
    }

    // Sync user profile to Firestore
    const isOwnerUser =
      result.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
    const userRef = doc(db, 'users', result.user.uid);

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const newProfile: UserProfile = {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'User',
          photoURL: result.user.photoURL || undefined,
          role: 'user',
          notificationPref: 'instant',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
      }
    } catch (e) {
      console.warn('Profile sync note:', e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';

    // Handle normal user cancellation without logging an error or crashing
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorMessage.includes('popup-closed-by-user') ||
      errorMessage.includes('cancelled-popup-request')
    ) {
      return null;
    }

    if (errorCode === 'auth/popup-blocked' || errorMessage.includes('popup-blocked')) {
      throw new Error(
        'Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site and try again.'
      );
    }

    console.warn('Google sign-in attempt warning:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Explicitly connects Google Workspace (Gmail + Drive) for the Owner.
 */
export const connectGoogleWorkspace = async (): Promise<boolean> => {
  try {
    const res = await googleSignIn(true);
    return !!res?.accessToken;
  } catch (e) {
    console.warn('Workspace connect note:', e);
    return false;
  }
};

export const hasGmailPermission = (): boolean => {
  return !!cachedAccessToken;
};

export const ensureGmailPermission = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const res = await googleSignIn(true);
    return res?.accessToken || null;
  } catch (err) {
    console.warn('Gmail permission authorization error:', err);
    throw err;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessTokenManually = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('hisaab_oauth_token', token);
    } else {
      sessionStorage.removeItem('hisaab_oauth_token');
    }
  }
};

export const emailSignUp = async (email: string, pass: string, displayName: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }

  const isOwnerUser = cred.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const userRef = doc(db, 'users', cred.user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email || '',
        displayName: displayName || 'User',
        role: 'user',
        notificationPref: 'instant',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, newProfile);
    }
  } catch (e) {
    console.warn('Profile sync note:', e);
  }

  return cred.user;
};

export const emailSignIn = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('hisaab_oauth_token');
  }
};
