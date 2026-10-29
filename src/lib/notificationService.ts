import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { buildMentionEmailHtml, buildMessageEmailHtml, sendNotificationEmailViaBackend } from './gmail';
import { SHARED_APP_URL } from './constants';
import { ChatMessage, DmMessage, PublicProfile } from '../types';

// In-memory set of handled event IDs to prevent duplicate processing
const processedEvents = new Set<string>();

/**
 * Atomically checks and claims an event for a single observer, preventing duplicate notification triggers
 */
export async function claimNotificationEvent(eventId: string): Promise<boolean> {
  if (processedEvents.has(eventId)) {
    return false;
  }
  // Synchronous lock immediately prevents any concurrent observer from claiming the same event
  processedEvents.add(eventId);

  try {
    const ref = doc(db, 'dispatchedNotifications', eventId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return false;
    }
    await setDoc(ref, {
      eventId,
      claimedAt: new Date().toISOString(),
      status: 'claimed',
    });
    return true;
  } catch (_) {
    return true;
  }
}

export async function hasDispatchedNotification(eventId: string): Promise<boolean> {
  if (processedEvents.has(eventId)) {
    return true;
  }
  try {
    const snap = await getDoc(doc(db, 'dispatchedNotifications', eventId));
    if (snap.exists()) {
      processedEvents.add(eventId);
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Updates details on an already claimed notification event
 */
export async function recordDispatchedNotification(eventId: string, details: Record<string, any>): Promise<void> {
  processedEvents.add(eventId);
  try {
    await setDoc(
      doc(db, 'dispatchedNotifications', eventId),
      {
        eventId,
        ...details,
        dispatchedAt: new Date().toISOString(),
        status: 'dispatched',
      },
      { merge: true }
    );
  } catch (e) {
    // Non-fatal
  }
}

/**
 * Notification Service that listens to Firestore events and dispatches Gmail notifications
 */
export function startNotificationService(
  currentUserId: string,
  currentUserDisplayName: string
): () => void {
  const unsubs: Unsubscribe[] = [];
  const serviceStartTime = new Date(Date.now() - 30 * 1000).toISOString(); // last 30s buffer

  // 1. Listen for new Squad Chat messages to process @mentions
  try {
    const messagesQ = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubMessages = onSnapshot(messagesQ, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const msg = change.doc.data() as ChatMessage;
          if (msg.createdAt < serviceStartTime) return; // ignore ancient messages on initial sync

          // Only process mentions if current user is the sender
          if (msg.userId === currentUserId && msg.text?.includes('@')) {
            const matches = msg.text.match(/@([a-zA-Z0-9_]+)/g);
            if (!matches) return;

            const handles = Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));

            for (const handle of handles) {
              const eventKey = `mention-${msg.id}-${handle}`;
              if (await hasDispatchedNotification(eventKey)) continue;

              try {
                // Find target user by username
                const uQ = query(collection(db, 'publicProfiles'), where('username', '==', handle), limit(1));
                const uSnap = await getDoc(doc(db, 'usernames', handle));
                let targetUid: string | null = null;

                if (uSnap.exists()) {
                  targetUid = uSnap.data().uid;
                }

                if (targetUid && targetUid !== currentUserId) {
                  // Real-time in-app & web notification delivery
                  const notifId = `notif-mention-${msg.id}-${targetUid}`;
                  try {
                    await setDoc(doc(db, 'notifications', notifId), {
                      id: notifId,
                      userId: targetUid,
                      title: `@${currentUserDisplayName} mentioned you in Squad Chat`,
                      body: msg.text,
                      link: `${SHARED_APP_URL}/?tab=chat`,
                      targetType: 'chat',
                      targetId: msg.id,
                      read: false,
                      processed: false,
                      createdAt: new Date().toISOString(),
                    });
                  } catch (_) {}

                  const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
                  if (targetUserSnap.exists()) {
                    const targetUser = targetUserSnap.data();
                    if (targetUser.email) {
                      const subject = `Hisaab: @${currentUserDisplayName} mentioned you in Squad Chat`;
                      const html = buildMentionEmailHtml({
                        targetName: targetUser.displayName || handle,
                        senderName: currentUserDisplayName,
                        messageText: msg.text,
                        sourceLabel: 'Squad Chat',
                        actionUrl: `${SHARED_APP_URL}/?tab=chat`,
                      });

                      const result = await sendNotificationEmailViaBackend({
                        toEmail: targetUser.email,
                        subject,
                        htmlBody: html,
                        textBody: `@${currentUserDisplayName} mentioned you: ${msg.text}`,
                      });

                      await recordDispatchedNotification(eventKey, {
                        type: 'mention',
                        recipientEmail: targetUser.email,
                        success: result.success,
                      });
                    }
                  }
                }
              } catch (err) {
                console.warn('Notification service mention error:', err);
              }
            }
          }
        }
      });
    });

    unsubs.push(unsubMessages);
  } catch (e) {
    console.warn('Squad message listener init note:', e);
  }

  // 2. Listen for Direct Messages in DM threads where current user is a participant
  try {
    const threadsQ = query(
      collection(db, 'dmThreads'),
      where('members', 'array-contains', currentUserId)
    );

    const unsubThreads = onSnapshot(threadsQ, (threadsSnap) => {
      threadsSnap.docs.forEach((threadDoc) => {
        const pairId = threadDoc.id;
        const uids = pairId.split('_');
        const recipientUid = uids.find((u) => u !== currentUserId);
        if (!recipientUid) return;

        // Listen for messages in this thread
        const msgQ = query(
          collection(db, 'dmThreads', pairId, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        const unsubDm = onSnapshot(msgQ, async (msgSnap) => {
          msgSnap.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const dm = change.doc.data() as DmMessage;
              if (dm.createdAt < serviceStartTime) return;

              // If sent by current user, verify notification dispatch to recipient
              if (dm.senderId === currentUserId) {
                const eventKey = `dm-${dm.id}-${recipientUid}`;
                if (await hasDispatchedNotification(eventKey)) return;

                try {
                  // Real-time in-app & web notification delivery
                  const notifId = `notif-dm-${dm.id}-${recipientUid}`;
                  try {
                    await setDoc(doc(db, 'notifications', notifId), {
                      id: notifId,
                      userId: recipientUid,
                      title: `💬 New message from ${currentUserDisplayName}`,
                      body: dm.text,
                      link: `${SHARED_APP_URL}/?tab=chat&dm=${currentUserId}`,
                      targetType: 'dm',
                      targetId: currentUserId,
                      read: false,
                      processed: false,
                      createdAt: new Date().toISOString(),
                    });
                  } catch (_) {}

                  const rUserSnap = await getDoc(doc(db, 'users', recipientUid));
                  if (rUserSnap.exists()) {
                    const rUser = rUserSnap.data();
                    if (rUser.email) {
                      const subject = `Hisaab: New message from ${currentUserDisplayName}`;
                      const html = buildMessageEmailHtml({
                        targetName: rUser.displayName || 'Friend',
                        senderName: currentUserDisplayName,
                        messageText: dm.text,
                        actionUrl: `${SHARED_APP_URL}/?tab=chat&dm=${currentUserId}`,
                      });

                      const result = await sendNotificationEmailViaBackend({
                        toEmail: rUser.email,
                        subject,
                        htmlBody: html,
                        textBody: `${currentUserDisplayName}: ${dm.text}`,
                      });

                      await recordDispatchedNotification(eventKey, {
                        type: 'dm',
                        recipientEmail: rUser.email,
                        success: result.success,
                      });
                    }
                  }
                } catch (err) {
                  console.warn('DM notification dispatch error:', err);
                }
              }
            }
          });
        });

        unsubs.push(unsubDm);
      });
    });

    unsubs.push(unsubThreads);
  } catch (e) {
    console.warn('DM thread listener init note:', e);
  }

  // Return teardown function
  return () => {
    unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch (_) {}
    });
  };
}
