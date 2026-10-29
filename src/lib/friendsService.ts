import { db, removeUndefined } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  PublicProfile,
  FriendRequest,
  Friendship,
  DmMessage,
  DmThread,
  AppNotification,
} from '../types';
import {
  buildInviteEmailHtml,
  buildMentionEmailHtml,
  buildMessageEmailHtml,
  queueNotificationEmail,
  sendInviteEmailViaBackend,
  sendNotificationEmailViaBackend,
} from './gmail';
import { SHARED_APP_URL, getInviteDeepLink } from './constants';

/**
 * Checks if a username is available in usernames/{name}
 */
export async function checkUsernameAvailable(rawName: string): Promise<boolean> {
  const name = rawName.trim().toLowerCase();
  if (!name.match(/^[a-z0-9_]{3,20}$/)) return false;

  try {
    const snap = await getDoc(doc(db, 'usernames', name));
    return !snap.exists();
  } catch (e) {
    return true;
  }
}

/**
 * Claims a username in a Firestore transaction
 */
export async function claimUsername(
  uid: string,
  rawName: string,
  displayName: string,
  photoURL?: string
): Promise<{ success: boolean; error?: string }> {
  const name = rawName.trim().toLowerCase();
  if (!name.match(/^[a-z0-9_]{3,20}$/)) {
    return {
      success: false,
      error: 'Username must be 3-20 characters (a-z, 0-9, and _ only).',
    };
  }

  const usernameRef = doc(db, 'usernames', name);
  const profileRef = doc(db, 'publicProfiles', uid);
  const userRef = doc(db, 'users', uid);

  try {
    await runTransaction(db, async (txn) => {
      const uSnap = await txn.get(usernameRef);
      if (uSnap.exists()) {
        throw new Error('This username is already taken. Try another.');
      }

      const now = new Date().toISOString();
      txn.set(usernameRef, {
        uid,
        username: name,
        createdAt: now,
      });

      const profile: PublicProfile = removeUndefined({
        uid,
        username: name,
        displayName,
        photoURL,
        createdAt: now,
      });
      txn.set(profileRef, profile);

      txn.update(userRef, {
        username: name,
        updatedAt: now,
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to claim username' };
  }
}

export interface UserSearchResult {
  uid: string;
  displayName: string;
  username?: string;
  email?: string;
  photoURL?: string;
}

export interface SearchResponse {
  users: UserSearchResult[];
  isEmailQuery: boolean;
  searchedEmail?: string;
}

/**
 * Searches users by email or username
 */
export async function searchUsersByEmailOrUsername(
  queryStr: string,
  excludeUid?: string
): Promise<SearchResponse> {
  const clean = queryStr.trim();
  if (!clean) return { users: [], isEmailQuery: false };

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  const results: UserSearchResult[] = [];
  const seenUids = new Set<string>();

  if (isEmail) {
    const cleanEmail = clean.toLowerCase();
    try {
      // 1. Query users collection by email
      const uQ = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(5));
      const uSnap = await getDocs(uQ);
      for (const d of uSnap.docs) {
        const u = d.data();
        if ((!excludeUid || d.id !== excludeUid) && !seenUids.has(d.id)) {
          seenUids.add(d.id);
          let username = '';
          try {
            const pSnap = await getDoc(doc(db, 'publicProfiles', d.id));
            if (pSnap.exists()) {
              username = pSnap.data().username || '';
            }
          } catch (_) {}

          results.push({
            uid: d.id,
            displayName: u.displayName || 'User',
            username,
            email: u.email,
            photoURL: u.photoURL,
          });
        }
      }
    } catch (e) {
      console.warn('Search email note:', e);
    }

    return {
      users: results,
      isEmailQuery: true,
      searchedEmail: cleanEmail,
    };
  }

  // Not a complete email - search by username prefix
  const cleanName = clean.replace(/^@/, '').toLowerCase();
  if (cleanName.length < 2) {
    return { users: [], isEmailQuery: false };
  }

  try {
    // 1. Search publicProfiles by username prefix
    const pQ = query(
      collection(db, 'publicProfiles'),
      where('username', '>=', cleanName),
      where('username', '<=', cleanName + '\uf8ff'),
      limit(10)
    );
    const pSnap = await getDocs(pQ);
    for (const d of pSnap.docs) {
      const p = d.data() as PublicProfile;
      if ((!excludeUid || p.uid !== excludeUid) && !seenUids.has(p.uid)) {
        seenUids.add(p.uid);
        let email = '';
        try {
          const uSnap = await getDoc(doc(db, 'users', p.uid));
          if (uSnap.exists()) {
            email = uSnap.data().email || '';
          }
        } catch (_) {}

        results.push({
          uid: p.uid,
          displayName: p.displayName,
          username: p.username,
          email,
          photoURL: p.photoURL,
        });
      }
    }

    // 2. Also search users collection by displayName if few results
    if (results.length < 5) {
      const uQ = query(
        collection(db, 'users'),
        where('displayName', '>=', clean),
        where('displayName', '<=', clean + '\uf8ff'),
        limit(5)
      );
      const uSnap = await getDocs(uQ);
      for (const d of uSnap.docs) {
        const u = d.data();
        if ((!excludeUid || d.id !== excludeUid) && !seenUids.has(d.id)) {
          seenUids.add(d.id);
          results.push({
            uid: d.id,
            displayName: u.displayName || 'User',
            username: '',
            email: u.email,
            photoURL: u.photoURL,
          });
        }
      }
    }
  } catch (e) {
    console.warn('Search username note:', e);
  }

  return {
    users: results,
    isEmailQuery: clean.includes('@') && clean.length > 5,
    searchedEmail: clean.includes('@') ? clean.toLowerCase() : undefined,
  };
}

/**
 * Searches public profiles by username prefix (backward compatibility)
 */
export async function searchProfilesByUsername(
  prefix: string,
  excludeUid?: string
): Promise<PublicProfile[]> {
  const clean = prefix.trim().toLowerCase();
  if (clean.length < 3) return [];

  try {
    const q = query(
      collection(db, 'publicProfiles'),
      where('username', '>=', clean),
      where('username', '<=', clean + '\uf8ff'),
      limit(10)
    );
    const snap = await getDocs(q);
    const results: PublicProfile[] = [];
    snap.forEach((d) => {
      const data = d.data() as PublicProfile;
      if (!excludeUid || data.uid !== excludeUid) {
        results.push(data);
      }
    });
    return results;
  } catch (e) {
    console.warn('Search profiles note:', e);
    return [];
  }
}

/**
 * Sends an email invite with Hisaab connect link attached using the backend Gmail API
 */
export async function sendEmailInviteWithLink(params: {
  toEmail: string;
  senderName: string;
  senderUsername?: string;
  senderUid: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanEmail = params.toEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const inviteUrl = getInviteDeepLink(params.senderUsername || params.senderUid, params.senderUid);

  try {
    // 1. Persist the invite document so when user signs up with this email or opens the link,
    // they are automatically connected or pending friend request is generated
    const inviteDocId = `inv-${Date.now()}-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    await setDoc(doc(db, 'emailInvites', inviteDocId), {
      id: inviteDocId,
      toEmail: cleanEmail,
      senderUid: params.senderUid,
      senderName: params.senderName,
      senderUsername: params.senderUsername || '',
      inviteUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    const res = await sendInviteEmailViaBackend({
      toEmail: cleanEmail,
      senderName: params.senderName,
      senderUsername: params.senderUsername,
      senderUid: params.senderUid,
      customInviteUrl: inviteUrl,
    });

    if (res.success) {
      // Also record in mailQueue for user audit & history log without double sending
      await queueNotificationEmail(
        {
          to: cleanEmail,
          friendName: cleanEmail.split('@')[0],
          subject: `Join ${params.senderName} on Hisaab (Shared Expense & Ledger Tracker)`,
          htmlBody: `Invitation sent via Gmail API with link: ${inviteUrl}`,
          textBody: `Salam! ${params.senderName} has invited you to connect on Hisaab: ${inviteUrl}`,
        },
        true // skipImmediateSend - already sent by backend!
      ).catch(() => {});

      return { success: true, messageId: res.messageId };
    } else {
      return { success: false, error: res.error || 'Failed to dispatch email' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send invite email' };
  }
}

/**
 * Parses and processes @mentions in any message, comment, or note
 */
export async function notifyMentions(params: {
  text: string;
  senderUser: { uid: string; displayName: string; email?: string };
  sourceType: 'chat' | 'comment' | 'expense' | 'dm';
  sourceLabel?: string;
  actionUrl?: string;
  excludeUids?: string[];
}): Promise<void> {
  const { text, senderUser, sourceType, sourceLabel, actionUrl, excludeUids = [] } = params;
  if (!text) return;
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches || matches.length === 0) return;

  const rawHandles = Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
  const label =
    sourceLabel ||
    (sourceType === 'chat'
      ? 'Squad Chat'
      : sourceType === 'comment'
      ? 'Expense Comment'
      : sourceType === 'expense'
      ? 'Expense'
      : 'Chat');
  const targetUrl = actionUrl || `${SHARED_APP_URL}/?tab=chat`;

  for (const handle of rawHandles) {
    try {
      let targetUid: string | null = null;
      let targetDisplayName = handle;
      let targetEmail: string | null = null;

      const q = query(collection(db, 'publicProfiles'), where('username', '==', handle), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = snap.docs[0].data();
        targetUid = p.uid;
        targetDisplayName = p.displayName || handle;
      }

      if (targetUid && targetUid !== senderUser.uid && !excludeUids.includes(targetUid)) {
        const uSnap = await getDoc(doc(db, 'users', targetUid));
        if (uSnap.exists()) {
          targetEmail = uSnap.data().email || null;
          if (uSnap.data().displayName) targetDisplayName = uSnap.data().displayName;
        }

        // 1. In-app notification
        const notifId = `notif-${Date.now()}-${targetUid}-${Math.random().toString(36).substr(2, 4)}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: targetUid,
          title: `@${senderUser.displayName} mentioned you in ${label}`,
          body: text.length > 90 ? text.slice(0, 90) + '...' : text,
          link: `${SHARED_APP_URL}/?tab=chat`,
          read: false,
          createdAt: new Date().toISOString(),
        });

        // 2. Auto email
        if (targetEmail) {
          const subject = `Hisaab: @${senderUser.displayName} mentioned you in ${label}`;
          const html = buildMentionEmailHtml({
            targetName: targetDisplayName,
            senderName: senderUser.displayName,
            messageText: text,
            sourceLabel: label,
            actionUrl: targetUrl || `${SHARED_APP_URL}/?tab=chat`,
          });
          await sendNotificationEmailViaBackend({
            toEmail: targetEmail,
            subject,
            htmlBody: html,
            textBody: `@${senderUser.displayName} mentioned you: ${text}`,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Mention processing error:', err);
    }
  }
}

/**
 * Helper to compute sorted pair ID
 */
export function getSortedUidPair(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/**
 * Sends a friend request
 */
export async function sendFriendRequest(params: {
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromPhotoURL?: string;
  toUid: string;
  toUsername?: string;
  toDisplayName?: string;
  ledgerFriendId?: string;
}): Promise<string> {
  const reqId = `freq-${Date.now()}`;
  const reqData: FriendRequest = removeUndefined({
    id: reqId,
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    fromDisplayName: params.fromDisplayName,
    fromPhotoURL: params.fromPhotoURL,
    toUid: params.toUid,
    toUsername: params.toUsername,
    toDisplayName: params.toDisplayName,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ledgerFriendId: params.ledgerFriendId,
  });

  await setDoc(doc(db, 'friendRequests', reqId), reqData);

  // In-app notification for receiver
  const notifId = `notif-${Date.now()}-${params.toUid}`;
  await setDoc(doc(db, 'notifications', notifId), {
    id: notifId,
    userId: params.toUid,
    title: 'Friend request received',
    body: `@${params.fromUsername} (${params.fromDisplayName}) sent you a friend request on Hisaab.`,
    read: false,
    createdAt: new Date().toISOString(),
  });

  return reqId;
}

/**
 * Accepts a friend request and creates the friendship
 */
export async function acceptFriendRequest(
  request: FriendRequest,
  acceptorDisplayName: string
): Promise<void> {
  const pairId = getSortedUidPair(request.fromUid, request.toUid);

  await updateDoc(doc(db, 'friendRequests', request.id), {
    status: 'accepted',
  });

  const friendship: Friendship = {
    id: pairId,
    members: [request.fromUid, request.toUid],
    requestId: request.id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'friendships', pairId), friendship);

  // Initialize DM thread
  await setDoc(
    doc(db, 'dmThreads', pairId),
    {
      id: pairId,
      members: [request.fromUid, request.toUid],
      createdAt: new Date().toISOString(),
      lastMessageText: 'Connected on Hisaab',
      lastMessageAt: new Date().toISOString(),
      lastMessageBy: request.toUid,
    },
    { merge: true }
  );

  // In-app notification for the sender
  const notifId = `notif-${Date.now()}-${request.fromUid}`;
  await setDoc(doc(db, 'notifications', notifId), {
    id: notifId,
    userId: request.fromUid,
    title: 'Friend request accepted',
    body: `${acceptorDisplayName} accepted your friend request. You can now chat 1:1!`,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Declines or cancels a request
 */
export async function updateRequestStatus(
  requestId: string,
  status: 'declined' | 'cancelled'
): Promise<void> {
  await updateDoc(doc(db, 'friendRequests', requestId), { status });
}

/**
 * Removes a friendship (Unfriend)
 */
export async function removeFriendship(pairId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendships', pairId));
}

/**
 * DM: Send a message in dmThreads/{pairId}/messages/{messageId}
 */
export async function sendDmMessage(
  pairId: string,
  messageData: Omit<DmMessage, 'id' | 'createdAt' | 'seen'>,
  customMsgId?: string
): Promise<string> {
  const msgId = customMsgId || `dmsg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date().toISOString();

  const fullMsg: DmMessage = removeUndefined({
    ...messageData,
    id: msgId,
    createdAt: now,
    seen: false,
  });

  const msgRef = doc(db, 'dmThreads', pairId, 'messages', msgId);
  const threadRef = doc(db, 'dmThreads', pairId);

  // Determine recipient UID from pairId
  const uids = pairId.split('_');
  const recipientUid = uids.find((u) => u !== messageData.senderId);

  // Background writes and notifications
  const bgTasks: Promise<any>[] = [
    setDoc(msgRef, fullMsg),
    setDoc(
      threadRef,
      {
        lastMessageText: messageData.text,
        lastMessageAt: now,
        lastMessageBy: messageData.senderId,
      },
      { merge: true }
    ),
  ];

  // 1. Notify friend in-app
  if (recipientUid) {
    const notifId = `notif-${Date.now()}-${recipientUid}`;
    const preview = messageData.text.length > 90 ? messageData.text.slice(0, 90) + '...' : messageData.text;
    bgTasks.push(
      setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: recipientUid,
        title: `Message from ${messageData.senderName}`,
        body: preview,
        link: `${SHARED_APP_URL}/?tab=chat&dm=${messageData.senderId}`,
        read: false,
        createdAt: now,
      })
    );

    // 2. Send email notification to friend if they have email registered
    bgTasks.push(
      getDoc(doc(db, 'users', recipientUid)).then(async (snap) => {
        if (snap.exists()) {
          const u = snap.data();
          if (u.email) {
            const subject = `Hisaab: Message from ${messageData.senderName}`;
            const html = buildMessageEmailHtml({
              targetName: u.displayName || 'Friend',
              senderName: messageData.senderName,
              messageText: messageData.text,
              actionUrl: `${SHARED_APP_URL}/?tab=chat&dm=${messageData.senderId}`,
            });
            await sendNotificationEmailViaBackend({
              toEmail: u.email,
              subject,
              htmlBody: html,
              textBody: `${messageData.senderName}: ${messageData.text}`,
            }).catch(() => {});
          }
        }
      }).catch((e) => console.warn('Recipient email lookup note:', e))
    );
  }

  // 3. Process any @mentions inside the DM text (exclude direct recipient to prevent duplicate notifications)
  bgTasks.push(
    notifyMentions({
      text: messageData.text,
      senderUser: {
        uid: messageData.senderId,
        displayName: messageData.senderName,
      },
      sourceType: 'dm',
      sourceLabel: 'Direct Message',
      excludeUids: recipientUid ? [recipientUid] : [],
    })
  );

  Promise.all(bgTasks).catch((err) => console.warn('DM write background error:', err));

  return msgId;
}

/**
 * DM: Edit message text (time limited to 15 minutes)
 */
export async function editDmMessage(
  pairId: string,
  messageId: string,
  newText: string,
  messageCreatedAt?: string
): Promise<{ success: boolean; error?: string }> {
  if (messageCreatedAt) {
    const elapsed = Date.now() - new Date(messageCreatedAt).getTime();
    if (elapsed > 15 * 60 * 1000) {
      return { success: false, error: 'Editing is only allowed within 15 minutes of sending.' };
    }
  }
  const msgRef = doc(db, 'dmThreads', pairId, 'messages', messageId);
  await updateDoc(msgRef, {
    text: newText.trim(),
    isEdited: true,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}

/**
 * DM: Delete message for everyone (time limited to 15 minutes)
 */
export async function deleteDmMessageForEveryone(
  pairId: string,
  messageId: string,
  messageCreatedAt?: string
): Promise<{ success: boolean; error?: string }> {
  if (messageCreatedAt) {
    const elapsed = Date.now() - new Date(messageCreatedAt).getTime();
    if (elapsed > 15 * 60 * 1000) {
      return { success: false, error: 'Delete for everyone is only allowed within 15 minutes.' };
    }
  }
  const msgRef = doc(db, 'dmThreads', pairId, 'messages', messageId);
  await updateDoc(msgRef, {
    isDeleted: true,
    deletedForEveryone: true,
    text: 'This message was deleted',
    deletedAt: new Date().toISOString(),
  });
  return { success: true };
}

/**
 * DM: Delete message for me only
 */
export async function deleteDmMessageForMe(
  pairId: string,
  messageId: string,
  currentUid: string
): Promise<void> {
  const msgRef = doc(db, 'dmThreads', pairId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (snap.exists()) {
    const existing = (snap.data().deletedFor as string[]) || [];
    const updated = Array.from(new Set([...existing, currentUid]));
    await updateDoc(msgRef, {
      deletedFor: updated,
    });
  }
}

/**
 * DM: Delete message legacy fallback
 */
export async function deleteDmMessage(
  pairId: string,
  messageId: string,
  hardDelete = false
): Promise<void> {
  if (hardDelete) {
    await deleteDoc(doc(db, 'dmThreads', pairId, 'messages', messageId));
  } else {
    await updateDoc(doc(db, 'dmThreads', pairId, 'messages', messageId), {
      isDeleted: true,
      deletedForEveryone: true,
      text: 'This message was deleted',
      deletedAt: new Date().toISOString(),
    });
  }
}

/**
 * DM: Toggle reaction
 */
export async function toggleDmReaction(
  pairId: string,
  messageId: string,
  emoji: string,
  uid: string
): Promise<void> {
  const msgRef = doc(db, 'dmThreads', pairId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;

  const msg = snap.data() as DmMessage;
  const currentReactions = msg.reactions || {};
  const currentList = currentReactions[emoji] || [];

  let nextList: string[];
  if (currentList.includes(uid)) {
    nextList = currentList.filter((id) => id !== uid);
  } else {
    nextList = [...currentList, uid];
  }

  const nextReactions = { ...currentReactions, [emoji]: nextList };
  await updateDoc(msgRef, { reactions: nextReactions });
}

/**
 * Clears all messages in a DM thread from the current user's side only.
 * The other user's chat history remains intact.
 */
export async function clearEntireDmThread(
  pairId: string,
  currentUid: string,
  _deleteForEveryone = false
): Promise<{ success: boolean; count: number }> {
  try {
    const msgsRef = collection(db, 'dmThreads', pairId, 'messages');
    const snap = await getDocs(msgsRef);
    if (snap.empty) {
      return { success: true, count: 0 };
    }

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      const data = d.data();
      const existingDeletedFor = (data.deletedFor as string[]) || [];
      if (!existingDeletedFor.includes(currentUid)) {
        batch.update(d.ref, {
          deletedFor: [...existingDeletedFor, currentUid],
        });
      }
    });

    const threadRef = doc(db, 'dmThreads', pairId);
    batch.update(threadRef, {
      [`clearedAt.${currentUid}`]: new Date().toISOString(),
    });

    await batch.commit();
    return { success: true, count: snap.docs.length };
  } catch (err: any) {
    console.error('Error clearing DM thread:', err);
    throw err;
  }
}

