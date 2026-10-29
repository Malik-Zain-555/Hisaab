import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

export interface TypingStatusEntry {
  userId: string;
  userName: string;
  userPhoto?: string;
  targetId: string; // squad ID or other user's UID or pairId
  chatType: 'squad' | 'dms';
  isTyping: boolean;
  activityType?: 'typing' | 'recording_audio';
  updatedAt: string;
}

export interface ActiveChatUserStatus {
  userId: string;
  userName: string;
  userPhoto?: string;
  activityType?: 'typing' | 'recording_audio';
}

/**
 * Updates the current user's typing or recording indicator in Firestore
 */
export async function updateTypingStatus(
  userId: string,
  userName: string,
  userPhoto: string | undefined,
  targetId: string,
  chatType: 'squad' | 'dms',
  isTyping: boolean,
  activityType: 'typing' | 'recording_audio' = 'typing'
): Promise<void> {
  if (!userId || !targetId) return;

  try {
    const ref = doc(db, 'typingStatus', userId);
    await setDoc(
      ref,
      {
        userId,
        userName: userName || 'Friend',
        userPhoto: userPhoto || '',
        targetId,
        chatType,
        isTyping,
        activityType,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    // Non-fatal if offline
    console.debug('Typing status update:', err);
  }
}

/**
 * Subscribes to typing and voice recording status updates for a specific target conversation (Squad or DM)
 */
export function subscribeToTypingUsers(
  targetId: string,
  currentUserId: string,
  onTypingChange: (typingUsers: ActiveChatUserStatus[]) => void
): Unsubscribe {
  if (!targetId || !currentUserId) {
    onTypingChange([]);
    return () => {};
  }

  const typingCol = collection(db, 'typingStatus');

  return onSnapshot(
    typingCol,
    (snapshot) => {
      const now = Date.now();
      const active: ActiveChatUserStatus[] = [];

      snapshot.docs.forEach((d) => {
        if (d.id === currentUserId) return; // Ignore own typing status
        const data = d.data() as TypingStatusEntry;

        if (
          data.isTyping &&
          (data.targetId === targetId || (data.targetId && targetId && data.targetId.includes(targetId)))
        ) {
          const elapsed = now - new Date(data.updatedAt).getTime();
          // Consider active only if updated within the last 4.5 seconds
          if (elapsed < 4500) {
            active.push({
              userId: data.userId,
              userName: data.userName,
              userPhoto: data.userPhoto,
              activityType: data.activityType || 'typing',
            });
          }
        }
      });

      onTypingChange(active);
    },
    (err) => {
      console.debug('Typing subscription:', err);
      onTypingChange([]);
    }
  );
}
