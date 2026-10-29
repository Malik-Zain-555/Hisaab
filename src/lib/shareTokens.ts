import { db, removeUndefined } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { ShareLinkDoc, LedgerEntry, PaymentMethodDetail } from '../types';
import { calculateFriendBalance } from './formatters';

/**
 * Generates 43 random characters from crypto.getRandomValues (base64url)
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Fetches or creates an active token for a friend
 */
export async function getOrCreateShareLink(
  friendId: string,
  friendName: string,
  entries: LedgerEntry[],
  paymentMethods?: PaymentMethodDetail[],
  ownerName?: string
): Promise<ShareLinkDoc> {
  const friendEntries = entries.filter((e) => e.friendId === friendId);
  const balance = calculateFriendBalance(friendId, entries);

  // Check if an existing active link exists
  try {
    const q = query(
      collection(db, 'shareLinks'),
      where('friendId', '==', friendId),
      where('revoked', '==', false)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const activeDoc = snap.docs[0];
      return {
        id: activeDoc.id,
        ...(activeDoc.data() as Omit<ShareLinkDoc, 'id'>),
      };
    }
  } catch (e) {
    console.warn('ShareLink lookup note:', e);
  }

  // Create new token
  const token = generateSecureToken();
  const newDoc: ShareLinkDoc = {
    id: token,
    friendId,
    createdAt: new Date().toISOString(),
    revoked: false,
    updatedAt: new Date().toISOString(),
    snapshot: {
      displayName: friendName,
      ownerName: ownerName || undefined,
      entries: friendEntries.map((e) => ({
        date: e.date,
        label: e.label,
        amount: e.amount,
        type: e.type,
      })),
      runningBalance: balance,
      paymentMethods: paymentMethods && paymentMethods.length > 0 ? paymentMethods : undefined,
    },
  };

  try {
    await setDoc(doc(db, 'shareLinks', token), removeUndefined(newDoc));
  } catch (e) {
    console.warn('ShareLink setDoc note:', e);
  }

  return newDoc;
}

/**
 * Updates snapshot of an existing link
 */
export async function updateShareLinkSnapshot(
  token: string,
  friendName: string,
  friendId: string,
  entries: LedgerEntry[],
  paymentMethods?: PaymentMethodDetail[],
  ownerName?: string
): Promise<void> {
  const friendEntries = entries.filter((e) => e.friendId === friendId);
  const balance = calculateFriendBalance(friendId, entries);

  try {
    await updateDoc(doc(db, 'shareLinks', token), removeUndefined({
      updatedAt: new Date().toISOString(),
      snapshot: {
        displayName: friendName,
        ownerName: ownerName || undefined,
        entries: friendEntries.map((e) => ({
          date: e.date,
          label: e.label,
          amount: e.amount,
          type: e.type,
        })),
        runningBalance: balance,
        paymentMethods: paymentMethods && paymentMethods.length > 0 ? paymentMethods : undefined,
      },
    }));
  } catch (e) {
    console.warn('Snapshot update note:', e);
  }
}

/**
 * Revokes a link
 */
export async function revokeShareLink(token: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'shareLinks', token), {
      revoked: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Revoke link note:', e);
  }
}

/**
 * Regenerates link (revokes or deletes old, creates new 43-char token)
 */
export async function regenerateShareLink(
  oldToken: string | null,
  friendId: string,
  friendName: string,
  entries: LedgerEntry[],
  paymentMethods?: PaymentMethodDetail[],
  ownerName?: string
): Promise<ShareLinkDoc> {
  if (oldToken) {
    try {
      await deleteDoc(doc(db, 'shareLinks', oldToken));
    } catch (e) {
      // or revoke
      await revokeShareLink(oldToken);
    }
  }

  const token = generateSecureToken();
  const friendEntries = entries.filter((e) => e.friendId === friendId);
  const balance = calculateFriendBalance(friendId, entries);

  const newDoc: ShareLinkDoc = {
    id: token,
    friendId,
    createdAt: new Date().toISOString(),
    revoked: false,
    updatedAt: new Date().toISOString(),
    snapshot: {
      displayName: friendName,
      ownerName: ownerName || undefined,
      entries: friendEntries.map((e) => ({
        date: e.date,
        label: e.label,
        amount: e.amount,
        type: e.type,
      })),
      runningBalance: balance,
      paymentMethods: paymentMethods && paymentMethods.length > 0 ? paymentMethods : undefined,
    },
  };

  try {
    await setDoc(doc(db, 'shareLinks', token), removeUndefined(newDoc));
  } catch (e) {
    console.warn('Regenerate setDoc note:', e);
  }

  return newDoc;
}
