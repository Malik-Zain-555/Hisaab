import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import {
  Send,
  MessageCircle,
  Users,
  Check,
  CheckCheck,
  Smile,
  Trash2,
  Edit2,
  Paperclip,
  ArrowLeft,
  DollarSign,
  UserX,
  Settings,
  Shield,
  ShieldCheck,
  UserPlus,
  X,
  CreditCard,
  Wallet,
  Sparkles,
  Info,
  Clock,
  Ban,
  AlertTriangle,
  Plus,
  KeyRound,
  Search,
  ChevronRight,
  Receipt,
  Share2,
  Mic,
  MicOff,
  Camera,
  Image as ImageIcon,
  BellRing,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  MoreHorizontal,
} from 'lucide-react';
import { formatShortDate, formatPKR } from '../lib/formatters';
import {
  sendDmMessage,
  deleteDmMessage,
  deleteDmMessageForEveryone,
  deleteDmMessageForMe,
  editDmMessage,
  toggleDmReaction,
  getSortedUidPair,
  clearEntireDmThread,
} from '../lib/friendsService';
import { updateTypingStatus, subscribeToTypingUsers, ActiveChatUserStatus } from '../lib/typingService';
import { DmMessage, DmThread, ChatMessage, UserProfile } from '../types';
import { getInviteDeepLink } from '../lib/constants';
import { db } from '../lib/firebase';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
  Card,
  Avatar,
  Button,
  Input,
  Segmented,
  Badge,
  Sheet,
  SwipeableRow,
  StaggerItem,
  SheetSkeleton,
} from '../ui';
import { CreateSquadModal } from './CreateSquadModal';
import { JoinSquadModal } from './JoinSquadModal';
import {
  LazyManageSquadModal,
  LazyAddFriendModal,
  LazyFriendLedgerSheet,
  preloadScreen,
} from '../lib/preloadRoutes';
import { VoicePlayer } from './VoicePlayer';
import { compressImageToDataUrl } from '../lib/mediaUtils';
import { sendPushNotificationToUser } from '../lib/fcmService';

const EMOJI_PALETTE = ['👍', '❤️', '😂', '🔥', '🎉', '💸', '🙏', '😮', '👏', '🤝'];

const formatChatDayLabel = (dateStr?: string): string => {
  if (!dateStr) return 'Today';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Today';
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === todayStr) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

export const ChatRoom: React.FC<{
  initialDirectUser?: string | null;
  onOpenQuickAdd?: () => void;
  onOpenSmartPaste?: () => void;
}> = ({
  initialDirectUser,
  onOpenQuickAdd,
  onOpenSmartPaste,
}) => {
  const {
    chatMessages,
    hasMoreChatMessages,
    loadMoreChatMessages,
    sendChatMessage,
    editChatMessage,
    deleteChatMessage,
    deleteChatMessageForEveryone,
    deleteChatMessageForMe,
    clearEntireSquadChat,
    toggleSquadMessageReaction,
    squadGroups,
    squadGroup,
    activeSquadId,
    setActiveSquadId,
    squadInvitations,
    respondToSquadInvitation,
    joinSquadByInviteCode,
    updateSquadConfig,
    addSquadMember,
    removeSquadMember,
    toggleSquadAdmin,
    currentUser,
    publicProfile,
    friends,
    allUsers,
    reactions,
    friendships,
    dmThreads,
    friendBalance,
    sendNudge,
    expenses,
    incomingRequests,
    acceptIncomingRequest,
    declineIncomingRequest,
    clearNotificationsForTarget,
    showToast,
  } = useApp();

  const [activeChatTab, setActiveChatTab] = useState<'squad' | 'dms'>(
    initialDirectUser ? 'dms' : 'squad'
  );
  const [selectedFriendship, setSelectedFriendship] = useState<any | null>(null);

  // New action modal & add friend modal
  const [showNewActionModal, setShowNewActionModal] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [ledgerSheetFriend, setLedgerSheetFriend] = useState<UserProfile | null>(null);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState<'dm' | 'squad' | null>(null);

  // Squad input & controls
  const [squadText, setSquadText] = useState('');
  const [editingSquadMsgId, setEditingSquadMsgId] = useState<string | null>(null);
  const [editingSquadText, setEditingSquadText] = useState('');
  const [showSquadSettingsModal, setShowSquadSettingsModal] = useState(false);
  const [showSquadMoneyModal, setShowSquadMoneyModal] = useState(false);
  const [showSquadEmojiPickerMsgId, setShowSquadEmojiPickerMsgId] = useState<string | null>(null);
  const [showSquadComposerEmoji, setShowSquadComposerEmoji] = useState(false);
  const [showCreateSquadModal, setShowCreateSquadModal] = useState(false);
  const [showJoinSquadModal, setShowJoinSquadModal] = useState(false);
  const [squadSearchQuery, setSquadSearchQuery] = useState('');

  // Auto-join via URL joinCode or joinSquad parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinCode') || params.get('joinSquad');
      if (code) {
        joinSquadByInviteCode(code);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // DM state & controls
  const [dmText, setDmText] = useState('');
  const [dmMessageList, setDmMessageList] = useState<DmMessage[]>([]);
  const [dmMessageLimit, setDmMessageLimit] = useState(50);
  const [hasMoreDmMessages, setHasMoreDmMessages] = useState(false);
  const [editingDmMsgId, setEditingDmMsgId] = useState<string | null>(null);
  const [editingDmText, setEditingDmText] = useState('');
  const [showDmMoneyModal, setShowDmMoneyModal] = useState(false);
  const [showDmEmojiPickerMsgId, setShowDmEmojiPickerMsgId] = useState<string | null>(null);
  const [showDmComposerEmoji, setShowDmComposerEmoji] = useState(false);

  // Money modal states
  const [moneyCardType, setMoneyCardType] = useState<'balance' | 'custom'>('balance');
  const [moneyCardAmount, setMoneyCardAmount] = useState('');
  const [moneyCardTitle, setMoneyCardTitle] = useState('');

  // WhatsApp-style Delete Modal state (single message)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    targetType: 'squad' | 'dm';
    messageId: string;
    senderUid: string;
    createdAt: string;
    threadId?: string;
  } | null>(null);

  // Clear Entire Chat Modal state (strictly from user's side only)
  const [clearWholeChatModal, setClearWholeChatModal] = useState<{
    isOpen: boolean;
    chatType: 'dm' | 'squad';
    targetId: string;
    title: string;
    recipientName?: string;
  } | null>(null);
  const [isClearingChat, setIsClearingChat] = useState<boolean>(false);

  // Audio / Voice Message Recording states
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [isPausedAudio, setIsPausedAudio] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingTarget, setRecordingTarget] = useState<'dm' | 'squad'>('dm');
  const [audioPreviewData, setAudioPreviewData] = useState<{
    audioUrl: string;
    duration: number;
    target: 'dm' | 'squad';
  } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingKeepAliveRef = useRef<any>(null);

  // Image Upload with optional caption & Lightbox preview states
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [pendingImageSend, setPendingImageSend] = useState<{
    target: 'dm' | 'squad';
    imageUrl: string;
    caption: string;
  } | null>(null);
  const dmImageInputRef = useRef<HTMLInputElement | null>(null);
  const squadImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);

  // Real-time typing & voice recording indicators state & timers
  const [squadTypingUsers, setSquadTypingUsers] = useState<ActiveChatUserStatus[]>([]);
  const [dmTypingUsers, setDmTypingUsers] = useState<ActiveChatUserStatus[]>([]);
  const squadTypingTimerRef = useRef<any>(null);
  const dmTypingTimerRef = useRef<any>(null);

  const squadEndRef = useRef<HTMLDivElement>(null);
  const dmEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time squad typing
  useEffect(() => {
    if (!activeSquadId || activeChatTab !== 'squad') {
      setSquadTypingUsers([]);
      return;
    }
    return subscribeToTypingUsers(activeSquadId, currentUser.uid, setSquadTypingUsers);
  }, [activeSquadId, activeChatTab, currentUser.uid]);

  // Subscribe to real-time DM typing
  useEffect(() => {
    if (!selectedFriendship || activeChatTab !== 'dms') {
      setDmTypingUsers([]);
      return;
    }
    return subscribeToTypingUsers(selectedFriendship.id, currentUser.uid, setDmTypingUsers);
  }, [selectedFriendship, activeChatTab, currentUser.uid]);

  // Auto scroll squad
  useEffect(() => {
    squadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeChatTab, squadTypingUsers]);

  // Auto scroll DMs
  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessageList, dmTypingUsers]);

  // Handle initial direct user selection
  useEffect(() => {
    if (initialDirectUser) {
      setActiveChatTab('dms');
      const pairId = getSortedUidPair(currentUser.uid, initialDirectUser);
      const existing = friendships.find((f) => f.id === pairId) || {
        id: pairId,
        members: [currentUser.uid, initialDirectUser],
      };
      setSelectedFriendship(existing);
    }
  }, [initialDirectUser, currentUser.uid, friendships]);

  // Subscribe to selected DM thread
  // Subscribe to selected DM thread with pagination limit for scalability
  useEffect(() => {
    if (!selectedFriendship) {
      setDmMessageList([]);
      setHasMoreDmMessages(false);
      return;
    }
    // Strictly reset so messages from previous conversation never bleed
    setDmMessageList([]);
    const pairId = selectedFriendship.id;
    const q = query(
      collection(db, 'dmThreads', pairId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(dmMessageLimit)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setHasMoreDmMessages(snap.docs.length >= dmMessageLimit);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DmMessage));
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setDmMessageList(list);
      },
      (err) => console.warn('DM listener:', err)
    );

    return () => {
      unsub();
      setDmMessageList([]);
    };
  }, [selectedFriendship, currentUser.uid, dmMessageLimit]);

  // Automatically clear pending notifications when user visits relevant DM or squad chat
  useEffect(() => {
    if (selectedFriendship) {
      const otherUid = selectedFriendship.members.find((id: string) => id !== currentUser.uid);
      if (otherUid) {
        clearNotificationsForTarget('dm', otherUid);
      }
    } else if (activeChatTab === 'squad') {
      clearNotificationsForTarget('chat');
    }
  }, [selectedFriendship, activeChatTab, currentUser.uid, clearNotificationsForTarget]);

  // SQUAD PERMISSION CHECKS
  const isSquadOwner = squadGroup?.ownerUid === currentUser.uid;
  const isSquadAdmin = isSquadOwner || (squadGroup?.admins || []).includes(currentUser.uid);
  const isSquadMember =
    !squadGroup ||
    squadGroup.members.length === 0 ||
    squadGroup.members.includes(currentUser.uid);

  const canAddMembers =
    isSquadOwner ||
    (squadGroup?.whoCanAdd === 'admins' && isSquadAdmin) ||
    squadGroup?.whoCanAdd === 'all_members';

  const canPostInSquad =
    isSquadAdmin || squadGroup?.whoCanPost !== 'admins_only';

  // --- SQUAD HANDLERS ---
  const handleSquadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSquadText(val);
    if (!activeSquadId) return;

    if (val.trim()) {
      updateTypingStatus(
        currentUser.uid,
        currentUser.displayName || 'Friend',
        currentUser.photoURL,
        activeSquadId,
        'squad',
        true
      );
      if (squadTypingTimerRef.current) clearTimeout(squadTypingTimerRef.current);
      squadTypingTimerRef.current = setTimeout(() => {
        updateTypingStatus(
          currentUser.uid,
          currentUser.displayName || 'Friend',
          currentUser.photoURL,
          activeSquadId,
          'squad',
          false
        );
      }, 3500);
    } else {
      updateTypingStatus(
        currentUser.uid,
        currentUser.displayName || 'Friend',
        currentUser.photoURL,
        activeSquadId,
        'squad',
        false
      );
      if (squadTypingTimerRef.current) clearTimeout(squadTypingTimerRef.current);
    }
  };

  const handleSendSquad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostInSquad) {
      showToast({ type: 'warning', message: 'Only squad admins can post in this group right now.' });
      return;
    }
    const text = squadText.trim();
    if (!text) return;
    setSquadText('');
    setShowSquadComposerEmoji(false);

    if (squadTypingTimerRef.current) clearTimeout(squadTypingTimerRef.current);
    if (activeSquadId) {
      updateTypingStatus(
        currentUser.uid,
        currentUser.displayName || 'Friend',
        currentUser.photoURL,
        activeSquadId,
        'squad',
        false
      );
    }

    sendChatMessage(text, undefined, squadGroup?.id);
  };

  const handleStartEditSquad = (msg: ChatMessage) => {
    const elapsed = Date.now() - new Date(msg.createdAt).getTime();
    if (elapsed > 15 * 60 * 1000) {
      showToast({
        type: 'error',
        message: 'Editing is only allowed within 15 minutes of sending.',
      });
      return;
    }
    setEditingSquadMsgId(msg.id);
    setEditingSquadText(msg.text);
  };

  const handleSaveEditSquad = async () => {
    if (!editingSquadMsgId) return;
    const res = await editChatMessage(editingSquadMsgId, editingSquadText);
    if (res?.success) {
      setEditingSquadMsgId(null);
      setEditingSquadText('');
    }
  };

  const handleOpenDeleteSquad = (msg: ChatMessage) => {
    setDeleteModal({
      isOpen: true,
      targetType: 'squad',
      messageId: msg.id,
      senderUid: msg.userId,
      createdAt: msg.createdAt,
    });
  };

  const handleSendSquadMoneyCard = async () => {
    const amountNum = parseFloat(moneyCardAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid amount in PKR.' });
      return;
    }
    const title = moneyCardTitle.trim() || 'Shared Expense Card';
    await sendChatMessage(
      `💸 Shared Money Card: ${title} (${formatPKR(amountNum)})`,
      {
        type: moneyCardType === 'balance' ? 'balance' : 'expense',
        title,
        amount: amountNum,
      },
      squadGroup?.id
    );
    setShowSquadMoneyModal(false);
    setMoneyCardAmount('');
    setMoneyCardTitle('');
    showToast({ type: 'success', message: 'Money card posted to Squad chat!' });
  };

  // --- DM HANDLERS ---
  const handleDmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDmText(val);
    if (!selectedFriendship) return;

    if (val.trim()) {
      updateTypingStatus(
        currentUser.uid,
        currentUser.displayName || 'Friend',
        currentUser.photoURL,
        selectedFriendship.id,
        'dms',
        true
      );
      if (dmTypingTimerRef.current) clearTimeout(dmTypingTimerRef.current);
      dmTypingTimerRef.current = setTimeout(() => {
        updateTypingStatus(
          currentUser.uid,
          currentUser.displayName || 'Friend',
          currentUser.photoURL,
          selectedFriendship.id,
          'dms',
          false
        );
      }, 3500);
    } else {
      updateTypingStatus(
        currentUser.uid,
        currentUser.displayName || 'Friend',
        currentUser.photoURL,
        selectedFriendship.id,
        'dms',
        false
      );
      if (dmTypingTimerRef.current) clearTimeout(dmTypingTimerRef.current);
    }
  };

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    const text = dmText.trim();
    if (!text || !selectedFriendship) return;
    setDmText('');
    setShowDmComposerEmoji(false);

    if (dmTypingTimerRef.current) clearTimeout(dmTypingTimerRef.current);
    updateTypingStatus(
      currentUser.uid,
      currentUser.displayName || 'Friend',
      currentUser.photoURL,
      selectedFriendship.id,
      'dms',
      false
    );

    const optimisticId = `dmsg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const optimisticMsg: DmMessage = {
      id: optimisticId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text,
      createdAt: new Date().toISOString(),
      seen: false,
    };
    setDmMessageList((prev) => [...prev, optimisticMsg]);

    sendDmMessage(
      selectedFriendship.id,
      {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text,
      },
      optimisticId
    ).catch((err) => console.warn('DM send error:', err));
  };

  const handleConfirmClearWholeChat = async () => {
    if (!clearWholeChatModal) return;
    setIsClearingChat(true);
    try {
      if (clearWholeChatModal.chatType === 'dm') {
        // User can only clear chat from his side only
        await clearEntireDmThread(
          clearWholeChatModal.targetId,
          currentUser.uid,
          false
        );
        setDmMessageList((prev) =>
          prev.filter((m) => !(m.deletedFor || []).includes(currentUser.uid))
        );
        showToast({
          type: 'success',
          message: 'Chat history cleared for you',
        });
      } else {
        await clearEntireSquadChat(clearWholeChatModal.targetId, false);
        showToast({
          type: 'success',
          message: 'Group chat history cleared for you',
        });
      }
      setClearWholeChatModal(null);
    } catch (err: any) {
      showToast({
        type: 'error',
        message: err?.message || 'Failed to clear chat history',
      });
    } finally {
      setIsClearingChat(false);
    }
  };

  const broadcastAudioActivity = (isRecording: boolean, target: 'dm' | 'squad') => {
    try {
      const targetId = target === 'dm' ? selectedFriendship?.id : activeSquadId;
      if (targetId) {
        updateTypingStatus(
          currentUser.uid,
          currentUser.displayName,
          currentUser.photoURL,
          targetId,
          target === 'dm' ? 'dms' : 'squad',
          isRecording,
          'recording_audio'
        );
      }
    } catch (_) {}
  };

  const startAudioRecording = async (target: 'dm' | 'squad') => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        showToast({ type: 'warning', message: 'Audio recording not supported on this browser.' });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mediaRecorder: MediaRecorder;
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      let selectedMimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        for (const type of candidateTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedMimeType = type;
            break;
          }
        }
      }

      try {
        mediaRecorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setRecordingTarget(target);
      setIsRecordingAudio(true);
      setIsPausedAudio(false);
      setRecordingDuration(0);
      setAudioPreviewData(null);

      // Start duration timer
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Broadcast real-time "Recording voice note..." animation to recipient
      broadcastAudioActivity(true, target);
      if (recordingKeepAliveRef.current) clearInterval(recordingKeepAliveRef.current);
      recordingKeepAliveRef.current = window.setInterval(() => {
        broadcastAudioActivity(true, target);
      }, 3000);

      showToast({ type: 'info', message: 'Recording voice note...' });
    } catch (err: any) {
      console.warn('Microphone error:', err);
      showToast({
        type: 'warning',
        message: 'Microphone permission needed to record voice messages.',
      });
    }
  };

  const pauseAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPausedAudio(true);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      showToast({ type: 'info', message: 'Recording paused.' });
    }
  };

  const resumeAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPausedAudio(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      broadcastAudioActivity(true, recordingTarget);
    }
  };

  const stopAndPreviewAudioRecording = () => {
    if (!mediaRecorderRef.current) return;
    const duration = recordingDuration;
    const target = recordingTarget;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingKeepAliveRef.current) {
      clearInterval(recordingKeepAliveRef.current);
      recordingKeepAliveRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const mimeType = recorder.mimeType || 'audio/webm';

    recorder.onstop = () => {
      try {
        if (!audioChunksRef.current.length) {
          showToast({ type: 'warning', message: 'No audio recorded. Please try again.' });
          setIsRecordingAudio(false);
          setIsPausedAudio(false);
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        recorder.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
        setIsPausedAudio(false);
        broadcastAudioActivity(false, target);

        const reader = new FileReader();
        reader.onloadend = () => {
          const audioUrl = reader.result as string;
          if (audioUrl) {
            setAudioPreviewData({
              audioUrl,
              duration,
              target,
            });
          }
        };
        reader.readAsDataURL(blob);
      } catch (e: any) {
        showToast({ type: 'error', message: 'Failed to process audio recording.' });
      }
    };

    recorder.stop();
  };

  const stopAndSendAudioRecording = async () => {
    if (!mediaRecorderRef.current) return;
    const duration = recordingDuration;
    const target = recordingTarget;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingKeepAliveRef.current) {
      clearInterval(recordingKeepAliveRef.current);
      recordingKeepAliveRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const mimeType = recorder.mimeType || 'audio/webm';

    recorder.onstop = async () => {
      try {
        if (!audioChunksRef.current.length) {
          showToast({ type: 'warning', message: 'No audio recorded. Please try again.' });
          setIsRecordingAudio(false);
          setIsPausedAudio(false);
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        recorder.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
        setIsPausedAudio(false);
        setRecordingDuration(0);
        broadcastAudioActivity(false, target);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const audioUrl = reader.result as string;
          if (!audioUrl) return;

          await sendFinalVoiceMessage(audioUrl, duration, target);
        };
        reader.readAsDataURL(blob);
      } catch (e: any) {
        showToast({ type: 'error', message: 'Failed to save voice recording.' });
      }
    };

    mediaRecorderRef.current.stop();
  };

  const sendFinalVoiceMessage = async (
    audioUrl: string,
    duration: number,
    target: 'dm' | 'squad'
  ) => {
    try {
      if (target === 'dm' && selectedFriendship) {
        await sendDmMessage(selectedFriendship.id, {
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          text: '',
          mediaType: 'audio',
          audioUrl,
          audioDuration: duration,
        });
        if (dmPartner?.uid) {
          sendPushNotificationToUser(dmPartner.uid, {
            title: 'Hisaab',
            body: `${currentUser.displayName || 'Friend'} sent you a voice note (${duration}s).`,
            link: `/?tab=chat&dm=${currentUser.uid}`,
            tag: `dm-${currentUser.uid}`,
          }).catch(() => {});
        }
      } else if (target === 'squad') {
        await sendChatMessage('', undefined, activeSquadId || undefined, {
          mediaType: 'audio',
          audioUrl,
          audioDuration: duration,
        });
      }
      setAudioPreviewData(null);
      setIsRecordingAudio(false);
      setRecordingDuration(0);
      showToast({ type: 'success', message: 'Voice note sent!' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to send voice note.' });
    }
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingKeepAliveRef.current) {
      clearInterval(recordingKeepAliveRef.current);
      recordingKeepAliveRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    broadcastAudioActivity(false, recordingTarget);
    setIsRecordingAudio(false);
    setIsPausedAudio(false);
    setRecordingDuration(0);
    setAudioPreviewData(null);
    showToast({ type: 'info', message: 'Voice note discarded.' });
  };

  const togglePreviewPlay = () => {
    if (!audioPreviewData?.audioUrl) return;
    if (!previewAudioRef.current) {
      const audio = new Audio(audioPreviewData.audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setIsPlayingPreview(false);
      audio.onpause = () => setIsPlayingPreview(false);
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current
        .play()
        .then(() => setIsPlayingPreview(true))
        .catch(() => setIsPlayingPreview(false));
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'dm' | 'squad'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMedia(true);
    try {
      showToast({ type: 'info', message: 'Preparing photo preview...' });
      const imageUrl = await compressImageToDataUrl(file, 900, 0.72);
      setPendingImageSend({
        target,
        imageUrl,
        caption: '',
      });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to process image file.' });
    } finally {
      setIsUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmSendImage = async () => {
    if (!pendingImageSend) return;
    const { target, imageUrl, caption } = pendingImageSend;
    const trimmedCaption = caption.trim();

    try {
      if (target === 'dm' && selectedFriendship) {
        await sendDmMessage(selectedFriendship.id, {
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          text: trimmedCaption,
          mediaType: 'image',
          imageUrl,
        });
        if (dmPartner?.uid) {
          sendPushNotificationToUser(dmPartner.uid, {
            title: 'Hisaab',
            body: trimmedCaption
              ? `${currentUser.displayName || 'Friend'} sent a photo: ${trimmedCaption}`
              : `${currentUser.displayName || 'Friend'} sent you a photo.`,
            link: `/?tab=chat&dm=${currentUser.uid}`,
            tag: `dm-${currentUser.uid}`,
          }).catch(() => {});
        }
      } else if (target === 'squad') {
        await sendChatMessage(trimmedCaption, undefined, activeSquadId || undefined, {
          mediaType: 'image',
          imageUrl,
        });
      }
      setPendingImageSend(null);
      showToast({ type: 'success', message: 'Photo sent!' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to send photo.' });
    }
  };

  const handleStartEditDm = (msg: DmMessage) => {
    const elapsed = Date.now() - new Date(msg.createdAt).getTime();
    if (elapsed > 15 * 60 * 1000) {
      showToast({
        type: 'error',
        message: 'Editing is only allowed within 15 minutes of sending.',
      });
      return;
    }
    setEditingDmMsgId(msg.id);
    setEditingDmText(msg.text);
  };

  const handleSaveEditDm = async () => {
    if (!editingDmMsgId || !selectedFriendship) return;
    const target = dmMessageList.find((m) => m.id === editingDmMsgId);
    const res = await editDmMessage(
      selectedFriendship.id,
      editingDmMsgId,
      editingDmText,
      target?.createdAt
    );
    if (res.success) {
      setDmMessageList((prev) =>
        prev.map((m) =>
          m.id === editingDmMsgId
            ? {
                ...m,
                text: editingDmText.trim(),
                isEdited: true,
                updatedAt: new Date().toISOString(),
              }
            : m
        )
      );
      setEditingDmMsgId(null);
      setEditingDmText('');
      showToast({ type: 'success', message: 'Direct message updated.' });
    } else {
      showToast({ type: 'error', message: res.error || 'Failed to edit message.' });
    }
  };

  const handleOpenDeleteDm = (msg: DmMessage) => {
    if (!selectedFriendship) return;
    setDeleteModal({
      isOpen: true,
      targetType: 'dm',
      messageId: msg.id,
      senderUid: msg.senderId,
      createdAt: msg.createdAt,
      threadId: selectedFriendship.id,
    });
  };

  const handleConfirmDelete = async (forEveryone: boolean) => {
    if (!deleteModal) return;
    const { targetType, messageId, threadId, createdAt } = deleteModal;

    if (targetType === 'squad') {
      if (forEveryone) {
        await deleteChatMessageForEveryone(messageId);
      } else {
        await deleteChatMessageForMe(messageId);
      }
    } else if (targetType === 'dm') {
      if (!threadId) return;
      if (forEveryone) {
        const res = await deleteDmMessageForEveryone(threadId, messageId, createdAt);
        if (res.success) {
          setDmMessageList((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    isDeleted: true,
                    deletedForEveryone: true,
                    text: 'This message was deleted',
                    deletedAt: new Date().toISOString(),
                  }
                : m
            )
          );
          showToast({ type: 'info', message: 'Message deleted for everyone.' });
        } else {
          showToast({ type: 'error', message: res.error || 'Failed to delete message.' });
        }
      } else {
        await deleteDmMessageForMe(threadId, messageId, currentUser.uid);
        setDmMessageList((prev) => prev.filter((m) => m.id !== messageId));
        showToast({ type: 'info', message: 'Message removed for you.' });
      }
    }
    setDeleteModal(null);
  };

  const handleToggleDmEmoji = async (messageId: string, emoji: string) => {
    if (!selectedFriendship) return;
    await toggleDmReaction(selectedFriendship.id, messageId, emoji, currentUser.uid);
    setShowDmEmojiPickerMsgId(null);
  };

  const handleSendDmMoneyCard = async () => {
    if (!selectedFriendship || !dmPartnerUid) return;
    const amountNum = parseFloat(moneyCardAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid amount in PKR.' });
      return;
    }
    const title = moneyCardTitle.trim() || 'Ledger Settlement Snapshot';
    await sendDmMessage(selectedFriendship.id, {
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text: `💸 Money Card: ${title} (${formatPKR(amountNum)})`,
      sharedCard: {
        type: moneyCardType === 'balance' ? 'balance' : 'expense',
        title,
        amount: amountNum,
      },
    });
    setShowDmMoneyModal(false);
    setMoneyCardAmount('');
    setMoneyCardTitle('');
    showToast({ type: 'success', message: 'Money card shared with friend!' });
  };

  // Contacts for DMs (both connected friendships and custom Khata friends)
  const dmContacts = React.useMemo(() => {
    const contactMap = new Map<string, any>();

    // 1. All friends from friends (both custom Khata and accepted users)
    friends.forEach((fr) => {
      const pairId = getSortedUidPair(currentUser.uid, fr.uid);
      const existingF = friendships.find((f) => f.id === pairId) || {
        id: pairId,
        members: [currentUser.uid, fr.uid],
        createdAt: fr.createdAt || new Date().toISOString(),
      };
      const thread = dmThreads.find((t) => t.id === pairId);
      contactMap.set(fr.uid, {
        friendship: existingF,
        otherUid: fr.uid,
        otherUser: fr,
        lastMessageText: thread?.lastMessageText || 'Tap to chat',
        lastMessageAt: thread?.lastMessageAt || fr.createdAt || new Date().toISOString(),
      });
    });

    // 2. Any additional friendships from Firestore where current user is a member
    friendships.forEach((f) => {
      if (!Array.isArray(f.members) || !f.members.includes(currentUser.uid)) return;
      const otherUid = f.members.find((id) => id !== currentUser.uid);
      if (otherUid && !contactMap.has(otherUid)) {
        const otherUser: UserProfile = allUsers.find((u) => u.uid === otherUid) || {
          uid: otherUid,
          displayName: 'User',
          email: '',
          role: 'friend',
          photoURL: undefined,
          notificationPref: 'instant',
          createdAt: new Date().toISOString(),
        };
        const thread = dmThreads.find((t) => t.id === f.id);
        contactMap.set(otherUid, {
          friendship: f,
          otherUid,
          otherUser,
          lastMessageText: thread?.lastMessageText || 'Tap to chat',
          lastMessageAt: thread?.lastMessageAt || f.createdAt,
        });
      }
    });

    return Array.from(contactMap.values()).sort((a, b) => {
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [friends, friendships, dmThreads, allUsers, currentUser.uid]);

  const filteredDmContacts = React.useMemo(() => {
    if (!dmSearchQuery.trim()) return dmContacts;
    const q = dmSearchQuery.toLowerCase();
    return dmContacts.filter((c) =>
      (c.otherUser.displayName || '').toLowerCase().includes(q) ||
      (c.otherUser.email || '').toLowerCase().includes(q) ||
      (c.otherUser.username || '').toLowerCase().includes(q)
    );
  }, [dmContacts, dmSearchQuery]);

  // Selected DM other user profile
  const dmPartnerUid = selectedFriendship?.members.find((id: string) => id !== currentUser.uid);
  const dmPartner: UserProfile =
    friends.find((f) => f.uid === dmPartnerUid) ||
    allUsers.find((u) => u.uid === dmPartnerUid) || {
      uid: dmPartnerUid || '',
      displayName: 'User',
      email: '',
      role: 'friend',
      photoURL: undefined,
      notificationPref: 'instant',
      createdAt: new Date().toISOString(),
    };

  const currentDmPartnerBalance = dmPartnerUid ? friendBalance(dmPartnerUid) : 0;

  const isActiveChatOpen =
    (activeChatTab === 'squad' && Boolean(activeSquadId && squadGroup)) ||
    (activeChatTab === 'dms' && Boolean(selectedFriendship));

  const visibleSquadMessages = React.useMemo(() => {
    if (!squadGroup) return [];
    return chatMessages.filter(
      (m) =>
        (m.squadId === squadGroup.id || (!m.squadId && squadGroup.id === 'default')) &&
        !(m.deletedFor || []).includes(currentUser.uid)
    );
  }, [chatMessages, squadGroup, currentUser.uid]);

  const visibleDmMessages = React.useMemo(() => {
    return dmMessageList.filter((m) => !(m.deletedFor || []).includes(currentUser.uid));
  }, [dmMessageList, currentUser.uid]);

  const sendQuickDmSuggestion = (text: string) => {
    if (!selectedFriendship) return;
    const optimisticId = `dmsg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const optimisticMsg: DmMessage = {
      id: optimisticId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text,
      createdAt: new Date().toISOString(),
      seen: false,
    };
    setDmMessageList((prev) => [...prev, optimisticMsg]);
    sendDmMessage(
      selectedFriendship.id,
      {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text,
      },
      optimisticId
    ).catch((err) => console.warn('DM suggestion send error:', err));
  };

  return (
    <div className={isActiveChatOpen ? 'chat-layout' : 'space-y-4 pb-6'}>
      {/* Top Chat Tabs Row: Personal / Squads tabs + Quick Actions */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap shrink-0">
        <div className="flex-1 min-w-[240px]">
          <Segmented
            options={[
              {
                value: 'dms',
                label: `Personal (${dmContacts.length})${
                  incomingRequests.length > 0 ? ` • ${incomingRequests.length}` : ''
                }`,
                icon: <MessageCircle className="w-4 h-4" />,
              },
              {
                value: 'squad',
                label: `Squads (${squadGroups.length})${
                  squadInvitations.length > 0 ? ` • ${squadInvitations.length}` : ''
                }`,
                icon: <Users className="w-4 h-4" />,
              },
            ]}
            value={activeChatTab}
            onChange={(val) => {
              setActiveChatTab(val as any);
              setSelectedFriendship(null);
              setShowHeaderMenu(null);
            }}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenQuickAdd && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenQuickAdd}
              icon={<DollarSign className="w-4 h-4 text-[var(--em)]" />}
            >
              Split Bill
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNewActionModal(true)}
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          >
            New
          </Button>
        </div>
      </div>

      {/* SQUADS TAB: SQUAD GROUPS DIRECTORY (When no group selected) */}
      {activeChatTab === 'squad' && (!activeSquadId || !squadGroup) && (
        <div className="space-y-4">
          <div className="card cq-card">
            <div className="ch">
              <div>
                <div className="chips mb-2">
                  <span className="chip on">{squadGroups.length} Active Squads</span>
                </div>
                <h2>Squad Groups &amp; Shared Rooms</h2>
                <p className="sub">
                  Private rooms for flatmates, trips, and shared group ledgers.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowJoinSquadModal(true)}
                  icon={<KeyRound className="w-4 h-4" />}
                >
                  Join Code
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateSquadModal(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Create Squad
                </Button>
              </div>
            </div>

            {/* Pending Invitations Banner */}
            {squadInvitations.length > 0 && (
              <div className="p-4 rounded-[22px] bg-[var(--surface-2)] border-[1.5px] border-[var(--su)]/40 space-y-2.5 mb-4">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--su)]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Squad Invitations
                  </span>
                  <span className="chip !py-1 !px-2.5 !text-[11px]">
                    {squadInvitations.length} pending
                  </span>
                </div>
                <div className="space-y-2">
                  {squadInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="min-h-[64px] p-3.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-[14px] bg-[var(--su)] text-[#2a1700] flex items-center justify-center text-lg font-extrabold shrink-0">
                          {inv.squadAvatar || '👥'}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="text-sm font-extrabold text-[var(--tx)] truncate">
                            {inv.squadName}
                          </p>
                          <p className="text-xs text-[var(--mu)] truncate">
                            Invited by <strong className="text-[var(--tx)]">{inv.invitedByName}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => respondToSquadInvitation(inv.id, true)}
                        >
                          Join
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => respondToSquadInvitation(inv.id, false)}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Squads Box (16px font size) */}
            {squadGroups.length > 0 && (
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-[var(--mu)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={squadSearchQuery}
                  onChange={(e) => setSquadSearchQuery(e.target.value)}
                  placeholder="Search squad groups..."
                  className="f !pl-11 !pr-4 !h-12 !text-[16px]"
                />
              </div>
            )}

            {/* Squads List (each row >= 64px tall) */}
            {squadGroups.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-[22px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center mx-auto text-2xl">
                  👥
                </div>
                <div>
                  <h4 className="text-base font-extrabold font-heading text-[var(--tx)]">
                    No Squads Yet
                  </h4>
                  <p className="text-xs text-[var(--mu)] max-w-sm mx-auto mt-1">
                    Squads are private rooms for roommates or trips. Create your own or join with an invite code.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="li">
                {squadGroups
                  .filter((g) =>
                    (g.name || '').toLowerCase().includes(squadSearchQuery.toLowerCase())
                  )
                  .map((squad) => {
                    const isOwner = squad.ownerUid === currentUser.uid;
                    const isAdmin = isOwner || (squad.admins || []).includes(currentUser.uid);
                    return (
                      <li
                        key={squad.id}
                        onClick={() => {
                          setActiveSquadId(squad.id);
                          setShowHeaderMenu(null);
                        }}
                        className="min-h-[64px] cursor-pointer group cq-card"
                      >
                        <div className="l min-w-0 flex-1">
                          <div
                            className="ic !w-12 !h-12 !rounded-[16px] text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--vi), var(--ro))' }}
                          >
                            {squad.avatarIcon || '👥'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="t flex items-center gap-2 flex-wrap">
                              <span className="truncate">{squad.name}</span>
                              {isOwner ? (
                                <span className="chip !py-0.5 !px-2 !text-[10px] !bg-[var(--su)] !text-[#2a1700] !border-0">
                                  👑 Owner
                                </span>
                              ) : isAdmin ? (
                                <span className="chip on !py-0.5 !px-2 !text-[10px]">
                                  🛡️ Admin
                                </span>
                              ) : null}
                            </div>

                            <div className="m truncate">
                              {squad.lastMessageText || squad.description || 'Tap to open squad room'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSquadId(squad.id);
                              setShowSquadSettingsModal(true);
                            }}
                            className="chip g !py-1 !px-2.5 !text-[11px] whitespace-nowrap cursor-pointer hover:opacity-90"
                            title="Simplify group debts"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            <span>Settle smartly</span>
                          </button>
                          <span className="chip !py-1 !px-2.5 !text-[11px] whitespace-nowrap">
                            👥 {squad.members?.length || 1}
                          </span>
                          <ChevronRight className="w-5 h-5 text-[var(--mu)] group-hover:text-[var(--em)] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* SQUAD SECTION: ACTIVE SQUAD CHAT (Tinted Violet, Fixed Viewport) */}
      {activeChatTab === 'squad' && activeSquadId && squadGroup && (
        <div className="c t-vi !p-0 flex-1 min-h-0 flex flex-col overflow-hidden border-[var(--vi)]/40">
          {/* Squad Header Bar: Back button, Avatar, Name & Balance/Status line + Settle smartly + "⋯" menu */}
          <div className="px-3.5 sm:px-4 py-3 bg-[#140B29]/75 backdrop-blur-xl border-b border-[var(--vi)]/30 flex items-center justify-between gap-2 shrink-0 relative z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveSquadId(null);
                  setShowHeaderMenu(null);
                }}
                className="ib !w-9 !h-9 shrink-0"
                title="Back to all groups"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--tx)]" />
              </button>

              <div
                onClick={() => setShowSquadSettingsModal(true)}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition min-w-0"
                title="Tap to view group details & Settle smartly"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[linear-gradient(135deg,var(--vi),var(--ro))] text-white flex items-center justify-center text-lg shrink-0 font-bold shadow-sm">
                  {squadGroup.avatarIcon || '👥'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <b className="text-sm sm:text-base text-[var(--tx)] truncate">
                      {squadGroup.name}
                    </b>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--vi)]/25 text-[#D2C4FF] border border-[var(--vi)]/40">
                      {squadGroup.members?.length || 1} members
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[#D2C4FF]/85 truncate">
                    {squadGroup.whoCanPost === 'admins_only'
                      ? '📢 Admins Only · Tap for Settle smartly'
                      : 'Shared Squad Room · Tap for Settle smartly'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Header Actions: Settle smartly button + "⋯" Menu */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSquadSettingsModal(true)}
                className="btn sm !h-9 !px-3"
                title="Simplify group debts and settle smartly"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Settle smartly</span>
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setShowHeaderMenu((prev) => (prev === 'squad' ? null : 'squad'))
                  }
                  className="ib !w-9 !h-9"
                  title="Chat options"
                  aria-label="Chat options"
                >
                  <MoreHorizontal className="w-5 h-5 text-[var(--tx)]" />
                </button>

                {showHeaderMenu === 'squad' && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowHeaderMenu(null)}
                    />
                    <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#160D2C]/95 backdrop-blur-2xl border border-[var(--line)] shadow-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(null);
                          setShowSquadSettingsModal(true);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--em)] hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-[var(--em)]" />
                        <span>Settle smartly &amp; Group</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(null);
                          sendChatMessage(
                            `🔔 Friendly reminder from ${currentUser.displayName}: please check your Hisaab squad balances!`,
                            undefined,
                            squadGroup.id
                          );
                          showToast({ type: 'success', message: 'Nudge posted to squad!' });
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--tx)] hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                      >
                        <BellRing className="w-4 h-4 text-[var(--su)]" />
                        <span>Nudge</span>
                      </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(null);
                        setMoneyCardAmount('');
                        setMoneyCardTitle('Squad Shared Expense');
                        setShowSquadMoneyModal(true);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--tx)] hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4 text-[var(--em)]" />
                      <span>Money Card</span>
                    </button>

                    <div className="my-1 border-t border-[var(--line)]" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(null);
                        setClearWholeChatModal({
                          isOpen: true,
                          chatType: 'squad',
                          targetId: squadGroup.id,
                          title: `Clear entire ${squadGroup.name} chat?`,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--ro)] hover:bg-[var(--ro)]/10 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Chat</span>
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>

          {/* Squad Messages Stream (Scrolls inside fixed layout) */}
          <div className="flex-1 min-h-0 p-3.5 sm:p-5 overflow-y-auto overscroll-contain space-y-3">
            {hasMoreChatMessages && (
              <div className="text-center py-1">
                <button
                  type="button"
                  onClick={loadMoreChatMessages}
                  className="chip hover:bg-white/20 cursor-pointer"
                >
                  Load older messages
                </button>
              </div>
            )}

            {visibleSquadMessages.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-4">
                <div className="w-14 h-14 rounded-[20px] bg-[var(--vi)]/25 border border-[var(--vi)]/40 text-2xl flex items-center justify-center mx-auto shadow-inner">
                  {squadGroup.avatarIcon || '👥'}
                </div>
                <div className="space-y-1">
                  <p className="text-base font-extrabold font-heading text-[var(--tx)]">
                    Welcome to {squadGroup.name}!
                  </p>
                  <p className="mu max-w-xs mx-auto text-xs">
                    {squadGroup.description ||
                      'Tap a suggestion chip below to break the ice or share a split expense card.'}
                  </p>
                </div>

                {/* Friendly Suggestion Chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-1">
                  {[
                    '👋 Assalam-o-Alaikum squad!',
                    '🍕 Let’s split dinner tonight',
                    '☕ Who is up for chai?',
                  ].map((chipText) => (
                    <button
                      key={chipText}
                      type="button"
                      disabled={!canPostInSquad}
                      onClick={() =>
                        sendChatMessage(chipText, undefined, squadGroup.id)
                      }
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/18 border border-[var(--vi)]/40 text-[var(--tx)] transition cursor-pointer disabled:opacity-40"
                    >
                      {chipText}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMoneyCardAmount('');
                      setMoneyCardTitle('Squad Shared Expense');
                      setShowSquadMoneyModal(true);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--em)]/20 hover:bg-[var(--em)]/30 border border-[var(--em)]/40 text-[var(--em)] transition cursor-pointer"
                  >
                    💸 Share Money Card
                  </button>
                </div>
              </div>
            ) : (
              visibleSquadMessages.map((msg, idx) => {
                const isMe = msg.userId === currentUser.uid;
                const isDeleted = msg.isDeleted || msg.deletedForEveryone;
                const elapsedMs = Date.now() - new Date(msg.createdAt).getTime();
                const canEditMsg = isMe && elapsedMs <= 15 * 60 * 1000 && !isDeleted;
                const canManageMsg = isMe || isSquadAdmin;
                const msgReactions = msg.reactions || {};
                const reactionEntries = Object.entries(msgReactions).filter(
                  ([_, uids]) => uids.length > 0
                );

                const prevMsg = idx > 0 ? visibleSquadMessages[idx - 1] : null;
                const currDayLabel = formatChatDayLabel(msg.createdAt);
                const prevDayLabel = prevMsg ? formatChatDayLabel(prevMsg.createdAt) : null;
                const showDaySeparator = currDayLabel !== prevDayLabel;

                return (
                  <React.Fragment key={msg.id}>
                    {showDaySeparator && (
                      <div className="flex items-center justify-center my-2.5 select-none">
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-black/35 border border-[var(--vi)]/35 text-[#D2C4FF] backdrop-blur-md">
                          {currDayLabel}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex items-end gap-2.5 ${
                        isMe ? 'justify-end' : 'justify-start'
                      } group`}
                    >
                      {!isMe && (
                        <Avatar name={msg.userName} photoURL={msg.userPhoto} size="sm" />
                      )}

                      <div className="max-w-[80%] sm:max-w-[72%] space-y-1">
                        {!isMe && (
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[11px] font-bold text-[#D2C4FF]">
                              {msg.userName}
                            </span>
                            {(squadGroup?.admins || []).includes(msg.userId) && (
                              <span className="chip g !h-4 !px-1.5 !text-[9px]">
                                <Shield className="w-2.5 h-2.5 mr-0.5" /> Admin
                              </span>
                            )}
                          </div>
                        )}

                        {/* Inline Shared Money Card */}
                        {!isDeleted && msg.sharedCard && (
                          <div className="p-3.5 rounded-[20px] bg-[linear-gradient(145deg,rgba(46,242,160,0.28),rgba(124,92,255,0.18))] border-[1.5px] border-[var(--em)]/45 backdrop-blur-md space-y-1 mb-1 shadow-md">
                            <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--em)]">
                              <span className="flex items-center gap-1.5 truncate">
                                <Wallet className="w-3.5 h-3.5 shrink-0" /> {msg.sharedCard.title}
                              </span>
                              <span className="chip g !h-5 !px-2 !text-[10px]">Money Card</span>
                            </div>
                            <div className="text-2xl font-extrabold font-heading text-[var(--tx)] num">
                              {formatPKR(msg.sharedCard.amount)}
                            </div>
                          </div>
                        )}

                        {/* Message Bubble or Tiny Italic Deleted Line */}
                        <div className="relative">
                          {isDeleted ? (
                            <p className="text-[11px] italic text-[var(--mu)]/75 px-2 py-0.5 select-none">
                              {isMe ? 'You deleted this message' : 'This message was deleted'}
                            </p>
                          ) : editingSquadMsgId === msg.id ? (
                            <div className="p-3 rounded-[20px] bg-[#160D2C] border-[1.5px] border-[var(--em)] space-y-2">
                              <input
                                type="text"
                                value={editingSquadText}
                                onChange={(e) => setEditingSquadText(e.target.value)}
                                className="w-full text-sm bg-transparent border-none focus:outline-none text-[var(--tx)]"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingSquadMsgId(null)}
                                  className="btn s sm !h-7 !px-2.5"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEditSquad}
                                  className="btn sm !h-7 !px-3"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`rounded-[22px] p-3.5 text-sm font-medium leading-relaxed relative border-[1.5px] backdrop-blur-md ${
                                isMe
                                  ? 'bg-[linear-gradient(145deg,rgba(46,242,160,0.32),rgba(14,165,164,0.14))] border-[var(--em)]/45 text-[var(--tx)] rounded-br-[6px]'
                                  : 'bg-[linear-gradient(145deg,rgba(124,92,255,0.24),rgba(255,255,255,0.07))] border-[var(--vi)]/35 text-[var(--tx)] rounded-bl-[6px]'
                              }`}
                            >
                              {msg.imageUrl && (
                                <div
                                  onClick={() => setActiveLightboxImage(msg.imageUrl || null)}
                                  className="mb-2 overflow-hidden rounded-[14px] cursor-pointer max-w-[280px]"
                                >
                                  <img
                                    src={msg.imageUrl}
                                    alt="Shared attachment"
                                    className="max-h-60 w-full object-cover rounded-[14px] hover:opacity-95 transition"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              {msg.audioUrl ? (
                                <VoicePlayer
                                  audioUrl={msg.audioUrl}
                                  duration={msg.audioDuration}
                                  isMe={isMe}
                                  isViolet={!isMe}
                                />
                              ) : msg.text &&
                                msg.text.trim() &&
                                !/^(📷\s*)?(photo|photot)$/i.test(msg.text.trim()) ? (
                                <p className="break-words">{msg.text}</p>
                              ) : null}
                              <div className="text-[10px] font-bold flex items-center justify-end gap-1.5 pt-1 text-[var(--mu)]">
                                {msg.isEdited && <span className="italic">Edited</span>}
                                <span>
                                  {new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {isMe && (
                                  <CheckCheck className="w-3.5 h-3.5 text-[var(--em)]" />
                                )}
                              </div>
                            </div>
                          )}

                          {/* Hover Quick Actions */}
                          {!editingSquadMsgId && !isDeleted && (
                            <div
                              className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#160D2C] border border-[var(--line)] px-2 py-1 rounded-full shadow-lg z-10 ${
                                isMe ? 'right-0' : 'left-0'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setShowSquadEmojiPickerMsgId(
                                    showSquadEmojiPickerMsgId === msg.id ? null : msg.id
                                  )
                                }
                                className="p-1 hover:text-[var(--em)] text-[var(--mu)] transition cursor-pointer"
                                title="React"
                              >
                                <Smile className="w-3.5 h-3.5" />
                              </button>

                              {canEditMsg && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSquad(msg)}
                                  className="p-1 hover:text-[var(--em)] text-[var(--mu)] transition cursor-pointer"
                                  title="Edit message"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canManageMsg && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteSquad(msg)}
                                  className="p-1 hover:text-[var(--ro)] text-[var(--mu)] transition cursor-pointer"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Emoji Picker Popup */}
                          {showSquadEmojiPickerMsgId === msg.id && (
                            <div className="absolute z-20 -top-11 left-0 bg-[#160D2C] border border-[var(--line)] rounded-full p-1.5 shadow-2xl flex items-center gap-1 animate-in fade-in zoom-in-95">
                              {EMOJI_PALETTE.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    toggleSquadMessageReaction(msg.id, emoji);
                                    setShowSquadEmojiPickerMsgId(null);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center hover:scale-125 transition-transform text-sm cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Displayed Reactions */}
                        {reactionEntries.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap px-1 pt-0.5">
                            {reactionEntries.map(([emoji, uids]) => {
                              const hasReacted = uids.includes(currentUser.uid);
                              return (
                                <span
                                  key={emoji}
                                  onClick={() => toggleSquadMessageReaction(msg.id, emoji)}
                                  className={`chip !h-6 !px-2.5 !text-xs cursor-pointer gap-1 ${
                                    hasReacted ? 'g' : ''
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[10px]">{uids.length}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}

            {/* Squad Real-Time Typing & Voice Recording Animation */}
            {squadTypingUsers.length > 0 &&
              (() => {
                const audioRecordingUsers = squadTypingUsers.filter(
                  (u) => u.activityType === 'recording_audio'
                );
                const textTypingUsers = squadTypingUsers.filter(
                  (u) => u.activityType !== 'recording_audio'
                );

                return (
                  <div className="space-y-1.5 px-1 py-1">
                    {audioRecordingUsers.length > 0 && (
                      <div className="flex items-center gap-2 bg-[var(--ro)]/15 border border-[var(--ro)]/40 px-3.5 py-1.5 rounded-2xl text-[var(--ro)] w-fit">
                        <Mic className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <span className="text-xs font-bold">
                          {audioRecordingUsers.map((u) => u.userName).join(', ')}{' '}
                          recording voice note...
                        </span>
                      </div>
                    )}

                    {textTypingUsers.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-2xl border border-[var(--line)] w-fit">
                        <span className="text-xs font-bold text-[var(--tx)]">
                          {textTypingUsers.map((u) => u.userName).join(', ')}
                        </span>
                        <span className="text-[11px] text-[var(--mu)]">typing...</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            <div ref={squadEndRef} />
          </div>

          {/* Emoji Toolbar for Squad Composer */}
          {showSquadComposerEmoji && (
            <div className="px-4 py-2 bg-black/40 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto shrink-0">
              <span className="text-[11px] font-bold text-[var(--mu)] shrink-0">Emojis:</span>
              {EMOJI_PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSquadText((prev) => prev + emoji)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-base hover:scale-110 transition shrink-0 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Hidden Squad Image Input */}
          <input
            type="file"
            ref={squadImageInputRef}
            accept="image/*"
            onChange={(e) => handleImageUpload(e, 'squad')}
            className="hidden"
          />

          {/* Voice Recording or Composer Bar for Squad (Always visible at bottom) */}
          {(isRecordingAudio || audioPreviewData) && recordingTarget === 'squad' ? (
            <div className="p-3 bg-[#140B29]/85 border-t border-[var(--vi)]/30 shrink-0">
              {audioPreviewData ? (
                <div className="flex items-center justify-between gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={togglePreviewPlay}
                      className="ib !bg-[var(--em)] !text-[#04140a]"
                    >
                      {isPlayingPreview ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                    <div>
                      <b className="text-xs text-[var(--tx)] block">Review Voice Note</b>
                      <span className="text-[11px] num text-[var(--mu)]">
                        {Math.floor(audioPreviewData.duration / 60)}:
                        {(audioPreviewData.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={cancelAudioRecording}
                      className="btn s sm !text-[var(--ro)]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Discard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        sendFinalVoiceMessage(
                          audioPreviewData.audioUrl,
                          audioPreviewData.duration,
                          'squad'
                        )
                      }
                      className="btn sm"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isPausedAudio ? 'bg-[var(--su)]' : 'bg-[var(--ro)] animate-ping'
                      }`}
                    />
                    <span className="text-xs font-extrabold num text-[var(--tx)]">
                      {isPausedAudio ? 'PAUSED' : 'REC'}{' '}
                      {Math.floor(recordingDuration / 60)}:
                      {(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={cancelAudioRecording}
                      className="btn s sm !text-[var(--ro)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isPausedAudio ? (
                      <button
                        type="button"
                        onClick={resumeAudioRecording}
                        className="btn s sm"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pauseAudioRecording}
                        className="btn s sm"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={stopAndPreviewAudioRecording}
                      className="btn s sm"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSendAudioRecording}
                      className="btn sm"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleSendSquad}
              className="p-2.5 sm:p-3 bg-[#140B29]/80 border-t border-[var(--vi)]/30 flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => setShowSquadComposerEmoji((prev) => !prev)}
                className="ib !w-9 !h-9 sm:!w-10 sm:!h-10 shrink-0"
                title="Add Emojis"
              >
                <Smile className="w-4 h-4 text-[var(--tx)]" />
              </button>

              <button
                type="button"
                onClick={() => squadImageInputRef.current?.click()}
                disabled={!canPostInSquad || isUploadingMedia}
                className="ib !w-9 !h-9 sm:!w-10 sm:!h-10 shrink-0 disabled:opacity-40"
                title="Send Photo"
              >
                <ImageIcon className="w-4 h-4 text-[var(--tx)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoneyCardAmount('');
                  setMoneyCardTitle('Shared Bill Split');
                  setShowSquadMoneyModal(true);
                }}
                className="ib !w-9 !h-9 sm:!w-10 sm:!h-10 shrink-0 !bg-[var(--em)]/20 !text-[var(--em)]"
                title="Attach Money/Expense Card"
              >
                <DollarSign className="w-4 h-4" />
              </button>

              <input
                type="text"
                placeholder={canPostInSquad ? 'Message squad...' : 'Only admins can post'}
                value={squadText}
                disabled={!canPostInSquad}
                onChange={handleSquadInputChange}
                className="flex-1 min-w-0 h-10 sm:h-11 bg-black/40 text-sm text-[var(--tx)] placeholder:text-[var(--mu)] px-4 rounded-full border border-[var(--line)] focus:border-[var(--em)] focus:outline-none disabled:opacity-50"
              />

              {squadText.trim() ? (
                <button
                  type="submit"
                  disabled={!canPostInSquad}
                  className="ib !w-10 !h-10 sm:!w-11 sm:!h-11 !bg-[var(--em)] !text-[#04140a] shrink-0"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canPostInSquad}
                  onClick={() => startAudioRecording('squad')}
                  className="ib !w-10 !h-10 sm:!w-11 sm:!h-11 !bg-[var(--em)] !text-[#04140a] shrink-0"
                  title="Record Voice Note"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* PERSONAL DMs & FRIENDS KHATA SECTION */}
      {activeChatTab === 'dms' && (
        <>
          {!selectedFriendship ? (
            <div className="space-y-4">
              {/* 1. Friends Khata & Balances Glass Card */}
              <div className="card cq-card">
                <div className="ch">
                  <div>
                    <h2>Friends Khata &amp; Balances</h2>
                    <p className="sub">Tap any friend to open their ledger or settle up</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddFriendModal(true)}
                    icon={<UserPlus className="w-4 h-4" />}
                  >
                    Add friend
                  </Button>
                </div>

                <div className="fg">
                  {friends.map((friend, idx) => {
                    const bal = friendBalance(friend.uid);
                    const tileColors = ['#0EA5A4', '#7C5CFF', '#FF5C8A', '#2EF2A0', '#FFC83D'];
                    const tileColor = tileColors[idx % tileColors.length];
                    const initial = (friend.displayName || 'F').charAt(0).toUpperCase();

                    return (
                      <div
                        key={friend.uid}
                        className="f cq-card"
                        onClick={() => setLedgerSheetFriend(friend)}
                      >
                        <div className="fh">
                          <span className="av" style={{ background: tileColor }}>
                            {friend.photoURL ? (
                              <img
                                src={friend.photoURL}
                                alt={friend.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              initial
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="fn truncate">{friend.displayName}</div>
                            <div className="fs truncate">
                              {bal > 0
                                ? 'Owes you'
                                : bal < 0
                                ? 'You owe'
                                : 'All settled'}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`fa whitespace-nowrap font-money tabular-nums cq-amount-lg ${
                            bal > 0 ? 'em' : bal < 0 ? 'ro' : ''
                          }`}
                        >
                          {bal > 0
                            ? `+${formatPKR(bal)}`
                            : bal < 0
                            ? `−${formatPKR(Math.abs(bal))}`
                            : 'Rs 0'}
                        </div>

                        <div className="flex items-center gap-1.5 mt-2.5 w-full">
                          <button
                            type="button"
                            className="btn s !py-1.5 !px-2.5 !text-xs flex-1 justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              const pairId = getSortedUidPair(currentUser.uid, friend.uid);
                              const existing = friendships.find((f) => f.id === pairId) || {
                                id: pairId,
                                members: [currentUser.uid, friend.uid],
                              };
                              setSelectedFriendship(existing);
                              setShowHeaderMenu(null);
                            }}
                          >
                            Chat
                          </button>
                          {bal > 0 && (
                            <button
                              type="button"
                              className="btn primary !py-1.5 !px-2.5 !text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendNudge(friend.uid);
                              }}
                            >
                              Remind
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="f flex flex-col items-center justify-center gap-2 border-dashed cursor-pointer min-h-[120px]"
                    onClick={() => setShowAddFriendModal(true)}
                  >
                    <span
                      className="av"
                      style={{ background: 'none', border: '2px dashed var(--line)' }}
                    >
                      +
                    </span>
                    <span className="text-xs font-extrabold text-[var(--mu)]">Add friend</span>
                  </button>
                </div>
              </div>

              {/* 2. Personal Direct Messages & Balance Pills List */}
              <div className="card cq-card">
                <div className="ch">
                  <div>
                    <h2>Personal Conversations ({dmContacts.length})</h2>
                    <p className="sub">Direct messages, inline money cards &amp; live balances</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowNewActionModal(true)}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    New chat
                  </Button>
                </div>

                {/* Incoming Friend Requests Banner */}
                {incomingRequests.length > 0 && (
                  <div className="p-4 rounded-[22px] bg-[var(--surface-2)] border-[1.5px] border-[var(--su)]/40 space-y-2.5 mb-4">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--su)]">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Incoming Friend Requests
                      </span>
                      <span className="chip !py-1 !px-2.5 !text-[11px]">
                        {incomingRequests.length} pending
                      </span>
                    </div>
                    <div className="space-y-2">
                      {incomingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="min-h-[64px] p-3.5 rounded-[18px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={req.fromDisplayName}
                              photoURL={req.fromPhotoURL}
                              size="sm"
                            />
                            <div className="min-w-0 truncate">
                              <p className="text-sm font-extrabold text-[var(--tx)] truncate">
                                {req.fromDisplayName}
                              </p>
                              <p className="text-xs text-[var(--mu)] truncate">
                                @{req.fromUsername}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => acceptIncomingRequest(req)}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => declineIncomingRequest(req.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Contacts Box (16px font size so iOS does not zoom) */}
                {dmContacts.length > 0 && (
                  <div className="relative mb-4">
                    <Search className="w-4 h-4 text-[var(--mu)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={dmSearchQuery}
                      onChange={(e) => setDmSearchQuery(e.target.value)}
                      placeholder="Search contacts & chats..."
                      className="f !pl-11 !pr-4 !h-12 !text-[16px]"
                    />
                  </div>
                )}

                {/* Contacts List (Every row >= 64px tall on mobile, balance pills never wrap) */}
                {filteredDmContacts.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-16 h-16 rounded-[22px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center mx-auto text-2xl">
                      💬
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold font-heading text-[var(--tx)]">
                        {dmSearchQuery
                          ? 'No matching contacts found'
                          : 'No personal chats yet'}
                      </h4>
                      <p className="text-xs text-[var(--mu)] max-w-sm mx-auto mt-1">
                        Add friends to chat, send voice notes, split bills, and track who owes what.
                      </p>
                    </div>
                    <div className="pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowAddFriendModal(true)}
                        icon={<UserPlus className="w-4 h-4" />}
                      >
                        Add Friend / Contact
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul className="li">
                    {filteredDmContacts.map((c, idx) => {
                      const bal = friendBalance(c.otherUid);
                      const isOwed = bal > 0;
                      const isSettled = bal === 0;

                      return (
                        <StaggerItem key={c.otherUid} index={idx}>
                          <SwipeableRow
                            onSwipeLeft={() => setLedgerSheetFriend(c.otherUser)}
                            onSwipeRight={isOwed ? () => sendNudge(c.otherUid) : () => setLedgerSheetFriend(c.otherUser)}
                            leftActionLabel="Ledger"
                            rightActionLabel={isOwed ? 'Remind' : 'Ledger'}
                          >
                            <li
                              onMouseEnter={() => preloadScreen('ledger')}
                              onClick={() => {
                                setSelectedFriendship(c.friendship);
                                setShowHeaderMenu(null);
                              }}
                              className="min-h-[64px] cursor-pointer cq-card"
                            >
                              <div className="l min-w-0 flex-1">
                                <Avatar
                                  name={c.otherUser.displayName}
                                  photoURL={c.otherUser.photoURL}
                                  size="md"
                                  ring={isSettled ? 'none' : isOwed ? 'green' : 'red'}
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="t flex items-center gap-2 flex-wrap">
                                    <span className="truncate">{c.otherUser.displayName}</span>
                                    {/* Balance Pill (nowrap, tabular-nums) */}
                                    <span
                                      className={`chip !py-0.5 !px-2.5 !text-[11px] font-money tabular-nums whitespace-nowrap shrink-0 ${
                                        isOwed
                                          ? 'on'
                                          : isSettled
                                          ? ''
                                          : '!bg-[var(--ro)]/18 !text-[var(--ro)] !border-[var(--ro)]/35'
                                      }`}
                                    >
                                      {isSettled
                                        ? 'Settled'
                                        : isOwed
                                        ? `Owes ${formatPKR(bal)}`
                                        : `You owe ${formatPKR(Math.abs(bal))}`}
                                    </span>
                                  </div>
                                  <div className="m truncate">{c.lastMessageText}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                                <span className="text-xs font-semibold text-[var(--mu)] whitespace-nowrap">
                                  {formatShortDate(c.lastMessageAt)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLedgerSheetFriend(c.otherUser);
                                  }}
                                  className="ib !w-9 !h-9"
                                  title="View Statement & Ledger"
                                >
                                  <Receipt className="w-4 h-4 text-[var(--em)]" />
                                </button>
                              </div>
                            </li>
                          </SwipeableRow>
                        </StaggerItem>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            /* Active 1:1 Direct Message Thread (Fixed Viewport calc(100dvh - top bar - gaps)) */
            <div className="c !p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Thread Header: Back button, Avatar, Name & Balance line (tap opens ledger) + single "⋯" menu */}
              <div className="px-3.5 sm:px-4 py-3 bg-black/40 backdrop-blur-xl border-b border-[var(--line)] flex items-center justify-between gap-2 shrink-0 relative z-20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFriendship(null);
                      setShowHeaderMenu(null);
                    }}
                    className="ib !w-9 !h-9 shrink-0"
                    title="Back to friends"
                  >
                    <ArrowLeft className="w-4 h-4 text-[var(--tx)]" />
                  </button>
                  <div
                    onClick={() => setLedgerSheetFriend(dmPartner)}
                    className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition min-w-0"
                    title="Tap to open ledger"
                  >
                    <Avatar
                      name={dmPartner.displayName}
                      photoURL={dmPartner.photoURL}
                      size="sm"
                      ring={
                        currentDmPartnerBalance === 0
                          ? 'none'
                          : currentDmPartnerBalance > 0
                          ? 'green'
                          : 'red'
                      }
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-extrabold text-[var(--tx)] truncate">
                        {dmPartner.displayName}
                      </h4>
                      <span
                        className={`text-[11px] font-bold flex items-center gap-1 num truncate ${
                          currentDmPartnerBalance === 0
                            ? 'text-[var(--mu)]'
                            : currentDmPartnerBalance > 0
                            ? 'text-[var(--em)]'
                            : 'text-[var(--ro)]'
                        }`}
                      >
                        {currentDmPartnerBalance === 0
                          ? 'Settled · Tap for ledger'
                          : currentDmPartnerBalance > 0
                          ? `Owes ${formatPKR(currentDmPartnerBalance)} · Tap for ledger`
                          : `You owe ${formatPKR(Math.abs(currentDmPartnerBalance))} · Tap for ledger`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Single "⋯" Menu holding Nudge, Statement, Money Card, and Clear Chat */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setShowHeaderMenu((prev) => (prev === 'dm' ? null : 'dm'))
                    }
                    className="ib !w-9 !h-9"
                    title="Chat options"
                    aria-label="Chat options"
                  >
                    <MoreHorizontal className="w-5 h-5 text-[var(--tx)]" />
                  </button>

                  {showHeaderMenu === 'dm' && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowHeaderMenu(null)}
                      />
                      <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#160D2C]/95 backdrop-blur-2xl border border-[var(--line)] shadow-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => {
                            setShowHeaderMenu(null);
                            sendNudge(dmPartner.uid);
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--tx)] hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                        >
                          <BellRing className="w-4 h-4 text-[var(--su)]" />
                          <span>Nudge</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowHeaderMenu(null);
                            setLedgerSheetFriend(dmPartner);
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--tx)] hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Receipt className="w-4 h-4 text-[var(--em)]" />
                          <span>Statement</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowHeaderMenu(null);
                            setMoneyCardAmount(String(Math.abs(currentDmPartnerBalance)));
                            setMoneyCardTitle('Current Ledger Balance');
                            setShowDmMoneyModal(true);
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--tx)] hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                        >
                          <DollarSign className="w-4 h-4 text-[var(--em)]" />
                          <span>Money Card</span>
                        </button>

                        <div className="my-1 border-t border-[var(--line)]" />

                        <button
                          type="button"
                          onClick={() => {
                            setShowHeaderMenu(null);
                            setClearWholeChatModal({
                              isOpen: true,
                              chatType: 'dm',
                              targetId: selectedFriendship.id,
                              title: `Clear entire chat with ${dmPartner.displayName}?`,
                              recipientName: dmPartner.displayName,
                            });
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[var(--ro)] hover:bg-[var(--ro)]/10 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Clear Chat</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Messages Stream (Scrolls inside fixed layout) */}
              <div className="flex-1 min-h-0 p-3.5 sm:p-5 overflow-y-auto overscroll-contain space-y-3">
                {hasMoreDmMessages && (
                  <div className="text-center py-1">
                    <button
                      type="button"
                      onClick={() => setDmMessageLimit((prev) => prev + 50)}
                      className="chip hover:bg-white/20 cursor-pointer"
                    >
                      Load older messages
                    </button>
                  </div>
                )}

                {visibleDmMessages.length === 0 ? (
                  <div className="py-12 px-4 text-center space-y-4">
                    <div className="mx-auto w-fit">
                      <Avatar
                        name={dmPartner.displayName}
                        photoURL={dmPartner.photoURL}
                        size="lg"
                        ring={
                          currentDmPartnerBalance === 0
                            ? 'none'
                            : currentDmPartnerBalance > 0
                            ? 'green'
                            : 'red'
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-extrabold font-heading text-[var(--tx)]">
                        Say salam to {dmPartner.displayName}!
                      </p>
                      <p className="mu text-xs max-w-xs mx-auto">
                        Tap a suggestion chip below, record a voice note, or share an inline money card.
                      </p>
                    </div>

                    {/* Friendly Suggestion Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-1">
                      {[
                        '👋 Assalam-o-Alaikum!',
                        '🍕 Let’s split dinner',
                        '💸 Sent my share via SadaPay',
                      ].map((chipText) => (
                        <button
                          key={chipText}
                          type="button"
                          onClick={() => sendQuickDmSuggestion(chipText)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/18 border border-[var(--line)] text-[var(--tx)] transition cursor-pointer"
                        >
                          {chipText}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setMoneyCardAmount(String(Math.abs(currentDmPartnerBalance)));
                          setMoneyCardTitle('Current Ledger Balance');
                          setShowDmMoneyModal(true);
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--em)]/20 hover:bg-[var(--em)]/30 border border-[var(--em)]/40 text-[var(--em)] transition cursor-pointer"
                      >
                        🧾 Share Money Card
                      </button>
                    </div>
                  </div>
                ) : (
                  visibleDmMessages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const isDeleted = msg.isDeleted || msg.deletedForEveryone;
                    const elapsedMs = Date.now() - new Date(msg.createdAt).getTime();
                    const canEditMsg = isMe && elapsedMs <= 15 * 60 * 1000 && !isDeleted;
                    const msgReactions = msg.reactions || {};
                    const reactionEntries = Object.entries(msgReactions).filter(
                      ([_, uids]) => uids.length > 0
                    );

                    const prevMsg = idx > 0 ? visibleDmMessages[idx - 1] : null;
                    const currDayLabel = formatChatDayLabel(msg.createdAt);
                    const prevDayLabel = prevMsg ? formatChatDayLabel(prevMsg.createdAt) : null;
                    const showDaySeparator = currDayLabel !== prevDayLabel;

                    return (
                      <React.Fragment key={msg.id}>
                        {showDaySeparator && (
                          <div className="flex items-center justify-center my-2.5 select-none">
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/[0.08] border border-[var(--line)] text-[var(--mu)] backdrop-blur-md">
                              {currDayLabel}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex items-end gap-2 ${
                            isMe ? 'justify-end' : 'justify-start'
                          } group`}
                        >
                          {!isMe && (
                            <Avatar
                              name={dmPartner.displayName}
                              photoURL={dmPartner.photoURL}
                              size="sm"
                            />
                          )}

                          <div className="max-w-[80%] sm:max-w-[72%] space-y-1">
                            {/* Inline Shared Money Card */}
                            {!isDeleted && msg.sharedCard && (
                              <div
                                onClick={() => setLedgerSheetFriend(dmPartner)}
                                className="p-3.5 rounded-[20px] bg-[linear-gradient(145deg,rgba(46,242,160,0.3),rgba(46,242,160,0.07))] border-[1.5px] border-[var(--em)]/45 mb-1 space-y-1 cursor-pointer hover:opacity-95 transition shadow-md"
                                title="Tap to open statement & ledger"
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--em)]">
                                  <span className="flex items-center gap-1.5 truncate">
                                    <Wallet className="w-3.5 h-3.5 shrink-0" />{' '}
                                    {msg.sharedCard.title}
                                  </span>
                                  <span className="chip g !h-5 !px-2 !text-[10px]">Ledger</span>
                                </div>
                                <div className="text-2xl font-extrabold font-heading text-[var(--tx)] num">
                                  {formatPKR(msg.sharedCard.amount)}
                                </div>
                              </div>
                            )}

                            {/* Bubble or Tiny Italic Deleted Line */}
                            <div className="relative">
                              {isDeleted ? (
                                <p className="text-[11px] italic text-[var(--mu)]/75 px-2 py-0.5 select-none">
                                  {isMe
                                    ? 'You deleted this message'
                                    : 'This message was deleted'}
                                </p>
                              ) : editingDmMsgId === msg.id ? (
                                <div className="p-3 rounded-[20px] bg-[#160D2C] border-[1.5px] border-[var(--em)] space-y-2">
                                  <input
                                    type="text"
                                    value={editingDmText}
                                    onChange={(e) => setEditingDmText(e.target.value)}
                                    className="w-full text-sm bg-transparent border-none focus:outline-none text-[var(--tx)]"
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDmMsgId(null)}
                                      className="btn s sm !h-7 !px-2.5"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleSaveEditDm}
                                      className="btn sm !h-7 !px-3"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`rounded-[22px] p-3.5 text-sm font-medium leading-relaxed relative border-[1.5px] backdrop-blur-md ${
                                    isMe
                                      ? 'bg-[linear-gradient(145deg,rgba(46,242,160,0.32),rgba(14,165,164,0.14))] border-[var(--em)]/45 text-[var(--tx)] rounded-br-[6px]'
                                      : 'bg-white/[0.08] border-white/16 text-[var(--tx)] rounded-bl-[6px]'
                                  }`}
                                >
                                  {msg.imageUrl && (
                                    <div
                                      onClick={() =>
                                        setActiveLightboxImage(msg.imageUrl || null)
                                      }
                                      className="mb-2 overflow-hidden rounded-[14px] cursor-pointer max-w-[280px]"
                                    >
                                      <img
                                        src={msg.imageUrl}
                                        alt="Shared photo"
                                        className="max-h-60 w-full object-cover rounded-[14px] hover:opacity-95 transition"
                                        loading="lazy"
                                      />
                                    </div>
                                  )}
                                  {msg.audioUrl ? (
                                    <VoicePlayer
                                      audioUrl={msg.audioUrl}
                                      duration={msg.audioDuration}
                                      isMe={isMe}
                                    />
                                  ) : msg.mediaType === 'nudge' ? (
                                    <div className="flex items-center gap-2 py-1">
                                      <span className="text-base">🔔</span>
                                      <span className="font-bold">{msg.text}</span>
                                    </div>
                                  ) : msg.text &&
                                    msg.text.trim() &&
                                    !/^(📷\s*)?(photo|photot)$/i.test(msg.text.trim()) ? (
                                    <p className="break-words">{msg.text}</p>
                                  ) : null}
                                  <div className="text-[10px] font-bold flex items-center justify-end gap-1 pt-1 text-[var(--mu)]">
                                    {msg.isEdited && <span className="italic mr-1">Edited</span>}
                                    <span>
                                      {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    {isMe && (
                                      <CheckCheck className="w-3.5 h-3.5 ml-0.5 text-[var(--em)]" />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Hover Quick Actions */}
                              {!editingDmMsgId && !isDeleted && (
                                <div
                                  className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#160D2C] border border-[var(--line)] px-2 py-1 rounded-full shadow-lg z-10 ${
                                    isMe ? 'right-0' : 'left-0'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowDmEmojiPickerMsgId(
                                        showDmEmojiPickerMsgId === msg.id ? null : msg.id
                                      )
                                    }
                                    className="p-1 hover:text-[var(--em)] text-[var(--mu)] transition cursor-pointer"
                                    title="React"
                                  >
                                    <Smile className="w-3.5 h-3.5" />
                                  </button>

                                  {canEditMsg && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditDm(msg)}
                                      className="p-1 hover:text-[var(--em)] text-[var(--mu)] transition cursor-pointer"
                                      title="Edit message"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteDm(msg)}
                                    className="p-1 hover:text-[var(--ro)] text-[var(--mu)] transition cursor-pointer"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* DM Emoji Picker Popup */}
                              {showDmEmojiPickerMsgId === msg.id && (
                                <div className="absolute z-20 -top-11 left-0 bg-[#160D2C] border border-[var(--line)] rounded-full p-1.5 shadow-2xl flex items-center gap-1 animate-in fade-in zoom-in-95">
                                  {EMOJI_PALETTE.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleDmEmoji(msg.id, emoji)}
                                      className="w-7 h-7 flex items-center justify-center hover:scale-125 transition-transform text-sm cursor-pointer"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Displayed DM Reactions */}
                            {reactionEntries.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap px-1 pt-0.5">
                                {reactionEntries.map(([emoji, uids]) => {
                                  const hasReacted = uids.includes(currentUser.uid);
                                  return (
                                    <span
                                      key={emoji}
                                      onClick={() => handleToggleDmEmoji(msg.id, emoji)}
                                      className={`chip !h-6 !px-2.5 !text-xs cursor-pointer gap-1 ${
                                        hasReacted ? 'g' : ''
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="text-[10px]">{uids.length}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}

                {/* DM Typing / Recording Indicator */}
                {dmTypingUsers.length > 0 &&
                  (() => {
                    const audioRecording = dmTypingUsers.filter(
                      (u) => u.activityType === 'recording_audio'
                    );
                    const textTyping = dmTypingUsers.filter(
                      (u) => u.activityType !== 'recording_audio'
                    );

                    return (
                      <div className="space-y-1.5 px-1 py-1">
                        {audioRecording.length > 0 && (
                          <div className="flex items-center gap-2.5 bg-[var(--ro)]/15 border border-[var(--ro)]/40 px-3.5 py-1.5 rounded-2xl text-[var(--ro)] w-fit">
                            <Mic className="w-3.5 h-3.5 animate-pulse shrink-0" />
                            <span className="text-xs font-bold">
                              {dmPartner.displayName} is recording a voice note...
                            </span>
                          </div>
                        )}

                        {textTyping.length > 0 && (
                          <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-2xl border border-[var(--line)] w-fit">
                            <span className="text-xs font-bold text-[var(--tx)]">
                              {dmPartner.displayName}
                            </span>
                            <span className="text-[11px] text-[var(--mu)]">is typing...</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                <div ref={dmEndRef} />
              </div>

              {/* Emoji Toolbar for DM Composer */}
              {showDmComposerEmoji && (
                <div className="px-4 py-2 bg-black/40 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto shrink-0">
                  <span className="text-[11px] font-bold text-[var(--mu)] shrink-0">Emojis:</span>
                  {EMOJI_PALETTE.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setDmText((prev) => prev + emoji)}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-base hover:scale-110 transition shrink-0 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Hidden DM Image Input */}
              <input
                type="file"
                ref={dmImageInputRef}
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'dm')}
                className="hidden"
              />

              {/* Voice Recording Bar or DM Input Composer (Always visible at bottom) */}
              {(isRecordingAudio || audioPreviewData) && recordingTarget === 'dm' ? (
                <div className="p-3 bg-black/45 border-t border-[var(--line)] shrink-0">
                  {audioPreviewData ? (
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={togglePreviewPlay}
                          className="ib !bg-[var(--em)] !text-[#04140a]"
                        >
                          {isPlayingPreview ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <div>
                          <b className="text-xs text-[var(--tx)] block">Review Voice Note</b>
                          <span className="text-[11px] num text-[var(--mu)]">
                            {Math.floor(audioPreviewData.duration / 60)}:
                            {(audioPreviewData.duration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={cancelAudioRecording}
                          className="btn s sm !text-[var(--ro)]"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Discard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            sendFinalVoiceMessage(
                              audioPreviewData.audioUrl,
                              audioPreviewData.duration,
                              'dm'
                            )
                          }
                          className="btn sm"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            isPausedAudio ? 'bg-[var(--su)]' : 'bg-[var(--ro)] animate-ping'
                          }`}
                        />
                        <span className="text-xs font-extrabold num text-[var(--tx)]">
                          {isPausedAudio ? 'PAUSED' : 'REC'}{' '}
                          {Math.floor(recordingDuration / 60)}:
                          {(recordingDuration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={cancelAudioRecording}
                          className="btn s sm !text-[var(--ro)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isPausedAudio ? (
                          <button
                            type="button"
                            onClick={resumeAudioRecording}
                            className="btn s sm"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={pauseAudioRecording}
                            className="btn s sm"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={stopAndPreviewAudioRecording}
                          className="btn s sm"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopAndSendAudioRecording}
                          className="btn sm"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={handleSendDm}
                  className="p-2.5 sm:p-3 bg-black/40 border-t border-[var(--line)] flex items-center gap-2 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setShowDmComposerEmoji((prev) => !prev)}
                    className="ib !w-9 !h-9 sm:!w-10 sm:!h-10 shrink-0"
                    title="Add Emojis"
                  >
                    <Smile className="w-4 h-4 text-[var(--tx)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => dmImageInputRef.current?.click()}
                    disabled={isUploadingMedia}
                    className="ib !w-9 !h-9 sm:!w-10 sm:!h-10 shrink-0 disabled:opacity-40"
                    title="Send Photo"
                  >
                    <ImageIcon className="w-4 h-4 text-[var(--tx)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoneyCardAmount(String(Math.abs(currentDmPartnerBalance)));
                      setMoneyCardTitle('Current Ledger Balance');
                      setShowDmMoneyModal(true);
                    }}
                    className="ib !w-9 !h-9 sm:!w-10 sm:!h-10 shrink-0 !bg-[var(--em)]/20 !text-[var(--em)]"
                    title="Share Money/Expense Card"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    placeholder={`Message ${dmPartner.displayName}...`}
                    value={dmText}
                    onChange={handleDmInputChange}
                    className="flex-1 min-w-0 h-10 sm:h-11 bg-black/35 text-sm text-[var(--tx)] placeholder:text-[var(--mu)] px-4 rounded-full border border-[var(--line)] focus:border-[var(--em)] focus:outline-none"
                  />

                  {dmText.trim() ? (
                    <button
                      type="submit"
                      className="ib !w-10 !h-10 sm:!w-11 sm:!h-11 !bg-[var(--em)] !text-[#04140a] shrink-0"
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startAudioRecording('dm')}
                      className="ib !w-10 !h-10 sm:!w-11 sm:!h-11 !bg-[var(--em)] !text-[#04140a] shrink-0"
                      title="Record Voice Note"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </div>
          )}
        </>
      )}

      {/* MANAGE SQUAD MODAL */}
      {showSquadSettingsModal && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyManageSquadModal
            isOpen={showSquadSettingsModal}
            onClose={() => setShowSquadSettingsModal(false)}
            targetSquad={squadGroup}
          />
        </Suspense>
      )}

      {/* CREATE SQUAD MODAL */}
      <CreateSquadModal
        isOpen={showCreateSquadModal}
        onClose={() => setShowCreateSquadModal(false)}
      />

      {/* JOIN SQUAD MODAL */}
      <JoinSquadModal
        isOpen={showJoinSquadModal}
        onClose={() => setShowJoinSquadModal(false)}
      />

      {/* NEW ACTION BOTTOM SHEET */}
      <Sheet
        isOpen={showNewActionModal}
        onClose={() => setShowNewActionModal(false)}
        title="Add or Create"
      >
        <div className="space-y-3 pb-2">
          <p className="mu">
            Connect with friends, start groups, split expenses, or invite your squad.
          </p>

          <div className="grid gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowNewActionModal(false);
                setShowAddFriendModal(true);
              }}
              className="p-4 rounded-[22px] bg-black/28 border-[1.5px] border-[var(--line)] hover:border-[var(--em)] flex items-center justify-between gap-3 text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="ct" style={{ '--c': 'var(--em)' } as React.CSSProperties}>
                  <UserPlus className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <b className="text-sm text-[var(--tx)] block">
                    Add Friend or Contact
                  </b>
                  <p className="mu mt-0.5">
                    Search by @username, email, or share a direct invite link
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--mu)] group-hover:text-[var(--em)] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowNewActionModal(false);
                setShowCreateSquadModal(true);
              }}
              className="p-4 rounded-[22px] bg-black/28 border-[1.5px] border-[var(--line)] hover:border-[var(--vi)] flex items-center justify-between gap-3 text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="ct" style={{ '--c': 'var(--vi)' } as React.CSSProperties}>
                  <Users className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <b className="text-sm text-[var(--tx)] block">
                    Create New Group
                  </b>
                  <p className="mu mt-0.5">
                    Start a shared group for your flatmates, squad, or trip
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--mu)] group-hover:text-[var(--em)] shrink-0" />
            </button>
          </div>
        </div>
      </Sheet>

      {/* ADD FRIEND / CONTACT MODAL */}
      {showAddFriendModal && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyAddFriendModal
            isOpen={showAddFriendModal}
            onClose={() => setShowAddFriendModal(false)}
            onFriendAdded={(newFriendId) => {
              setShowAddFriendModal(false);
              const pairId = getSortedUidPair(currentUser.uid, newFriendId);
              const existingF = friendships.find((f) => f.id === pairId) || {
                id: pairId,
                members: [currentUser.uid, newFriendId],
                createdAt: new Date().toISOString(),
              };
              setActiveChatTab('dms');
              setSelectedFriendship(existingF);
            }}
          />
        </Suspense>
      )}

      {/* FRIEND LEDGER & STATEMENT SHEET */}
      {ledgerSheetFriend && (
        <Suspense fallback={<SheetSkeleton />}>
          <LazyFriendLedgerSheet
            friend={ledgerSheetFriend}
            isOpen={!!ledgerSheetFriend}
            onClose={() => setLedgerSheetFriend(null)}
            onFriendRemoved={() => {
              setLedgerSheetFriend(null);
              setSelectedFriendship(null);
            }}
          />
        </Suspense>
      )}

      {/* DELETE MESSAGE MODAL */}
      {deleteModal &&
        deleteModal.isOpen &&
        (() => {
          const isOwn = deleteModal.senderUid === currentUser.uid;
          const ageMs = Date.now() - new Date(deleteModal.createdAt).getTime();
          const isWithin15m = ageMs <= 15 * 60 * 1000;
          const canEveryone =
            (isOwn && isWithin15m) || (deleteModal.targetType === 'squad' && isSquadAdmin);

          return (
            <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#160D2C] rounded-[28px] border-[1.5px] border-[var(--line)] p-6 max-w-sm w-full space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <span className="ct" style={{ '--c': 'var(--ro)' } as React.CSSProperties}>
                    <Trash2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-base font-extrabold font-heading text-[var(--tx)]">
                      Delete message?
                    </h4>
                    <p className="mu">Choose how you want to delete this message.</p>
                  </div>
                </div>

                {isOwn && !isWithin15m && !canEveryone && (
                  <div className="p-3 rounded-[16px] bg-black/30 border border-[var(--su)]/40 text-xs text-[var(--su)] flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      &apos;Delete for everyone&apos; is available within 15 minutes of sending.
                    </span>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  {canEveryone && (
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={() => handleConfirmDelete(true)}
                      icon={<Trash2 className="w-4 h-4" />}
                    >
                      Delete for everyone
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => handleConfirmDelete(false)}
                    icon={<UserX className="w-4 h-4" />}
                  >
                    Delete for me
                  </Button>

                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => setDeleteModal(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* CLEAR ENTIRE CHAT CONFIRMATION MODAL */}
      {clearWholeChatModal && clearWholeChatModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#160D2C] rounded-[28px] border-[1.5px] border-[var(--line)] p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="ct" style={{ '--c': 'var(--ro)' } as React.CSSProperties}>
                <Trash2 className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h4 className="text-base font-extrabold font-heading text-[var(--tx)] truncate">
                  Clear Chat (For Me Only)
                </h4>
                <p className="mu">Clear messages from your view only.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-[18px] bg-black/30 border border-[var(--line)] text-xs text-[var(--mu)] space-y-1">
              <div className="font-bold text-[var(--tx)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--su)]" /> User-Side Chat Clearance
              </div>
              <p>
                This clears conversation history <strong className="text-[var(--tx)]">strictly from your side only</strong>. Other participants keep their own history.
              </p>
            </div>

            <div className="pt-1 space-y-2.5">
              <Button
                variant="danger"
                fullWidth
                isLoading={isClearingChat}
                onClick={handleConfirmClearWholeChat}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Clear From My Side
              </Button>

              <Button
                variant="ghost"
                fullWidth
                disabled={isClearingChat}
                onClick={() => setClearWholeChatModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SQUAD MONEY CARD MODAL */}
      <Sheet
        isOpen={showSquadMoneyModal}
        onClose={() => setShowSquadMoneyModal(false)}
        title="Share Money Card in Squad"
      >
        <div className="space-y-4">
          <p className="mu">
            Post an interactive money or ledger snapshot directly into the squad conversation.
          </p>

          <div className="space-y-3">
            <Input
              label="Card Title / Purpose"
              placeholder="e.g. Dinner bill split, Grocery share"
              value={moneyCardTitle}
              onChange={(e) => setMoneyCardTitle(e.target.value)}
            />

            <Input
              label="Amount (PKR)"
              type="number"
              placeholder="e.g. 1500"
              value={moneyCardAmount}
              onChange={(e) => setMoneyCardAmount(e.target.value)}
            />

            {expenses.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="mu block">Or pick from recent expenses:</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {expenses.slice(0, 5).map((exp) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => {
                        setMoneyCardTitle(exp.title);
                        setMoneyCardAmount(String(exp.amount));
                      }}
                      className="chip hover:bg-white/20 cursor-pointer gap-1.5"
                    >
                      <span>{exp.title}</span>
                      <span className="font-bold text-[var(--em)] num">
                        {formatPKR(exp.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSendSquadMoneyCard}
            icon={<Send className="w-4 h-4" />}
          >
            Post Money Card to Squad
          </Button>
        </div>
      </Sheet>

      {/* DM MONEY CARD MODAL */}
      <Sheet
        isOpen={showDmMoneyModal}
        onClose={() => setShowDmMoneyModal(false)}
        title={`Share Money Card with ${dmPartner.displayName}`}
      >
        <div className="space-y-4">
          <p className="mu">
            Share your mutual ledger balance or attach an expense snapshot into direct chat.
          </p>

          <div className="p-4 rounded-[20px] t-em border border-[var(--em)]/40 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--tx)]">Current Ledger Balance:</span>
            <span className="text-lg font-extrabold font-heading text-[var(--em)] num">
              {formatPKR(currentDmPartnerBalance)}
            </span>
          </div>

          <div className="space-y-3">
            <Input
              label="Card Title / Purpose"
              placeholder="e.g. Current ledger balance, Settlement snapshot"
              value={moneyCardTitle}
              onChange={(e) => setMoneyCardTitle(e.target.value)}
            />

            <Input
              label="Amount (PKR)"
              type="number"
              placeholder="e.g. 2500"
              value={moneyCardAmount}
              onChange={(e) => setMoneyCardAmount(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSendDmMoneyCard}
            icon={<Send className="w-4 h-4" />}
          >
            Send Money Card to {dmPartner.displayName}
          </Button>
        </div>
      </Sheet>

      {/* SEND PHOTO PREVIEW & OPTIONAL CAPTION MODAL */}
      {pendingImageSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#160D2C] rounded-[28px] max-w-md w-full overflow-hidden shadow-2xl border-[1.5px] border-[var(--line)]">
            <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[var(--em)]" />
                <h3 className="font-extrabold font-heading text-base text-[var(--tx)]">
                  Send Photo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingImageSend(null)}
                className="ib !w-8 !h-8"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-black/40 flex items-center justify-center">
              <img
                src={pendingImageSend.imageUrl}
                alt="Preview before sending"
                className="max-h-72 w-auto object-contain rounded-[18px]"
              />
            </div>

            <div className="p-5 space-y-4">
              <Input
                label="Add a caption (optional)"
                placeholder="Type a message..."
                value={pendingImageSend.caption}
                onChange={(e) =>
                  setPendingImageSend((prev) =>
                    prev ? { ...prev, caption: e.target.value } : null
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmSendImage();
                  }
                }}
                autoFocus
              />

              <div className="flex items-center justify-end gap-2.5">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setPendingImageSend(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleConfirmSendImage}
                  icon={<Send className="w-4 h-4" />}
                >
                  Send Photo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX IMAGE VIEWER */}
      {activeLightboxImage && (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
          >
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
              <a
                href={activeLightboxImage}
                download="hisaab-photo.jpg"
                className="ib"
                title="Download photo"
              >
                <Share2 className="w-4 h-4 text-white" />
              </a>
              <button
                type="button"
                onClick={() => setActiveLightboxImage(null)}
                className="ib"
                title="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <img
              src={activeLightboxImage}
              alt="Enlarged photo"
              className="max-h-[85vh] max-w-full object-contain rounded-[22px] shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
