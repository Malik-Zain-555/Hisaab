import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  searchUsersByEmailOrUsername,
  sendEmailInviteWithLink,
  UserSearchResult,
} from '../lib/friendsService';
import { getInviteDeepLink } from '../lib/constants';
import {
  Search,
  UserPlus,
  Share2,
  Copy,
  Mail,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { Avatar, Input, Sheet, Segmented } from '../ui';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded?: (friendId: string) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    publicProfile,
    sendRequestToUser,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<'search' | 'invite'>('search');

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isEmailSearch, setIsEmailSearch] = useState(false);
  const [searchedEmail, setSearchedEmail] = useState<string | null>(null);
  const [isSendingInviteMail, setIsSendingInviteMail] = useState(false);
  const [inviteMailSent, setInviteMailSent] = useState(false);

  const inviteUrl = getInviteDeepLink(publicProfile?.username || currentUser.uid, currentUser.uid);

  const handleSearch = async (queryStr: string) => {
    setSearchQuery(queryStr);
    setInviteMailSent(false);
    const clean = queryStr.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setIsEmailSearch(false);
      setSearchedEmail(null);
      return;
    }

    setIsSearching(true);
    try {
      const resp = await searchUsersByEmailOrUsername(clean, currentUser.uid);
      setSearchResults(resp.users);
      setIsEmailSearch(resp.isEmailQuery);
      setSearchedEmail(resp.searchedEmail || (clean.includes('@') ? clean.toLowerCase() : null));
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    await sendRequestToUser(user.uid, user.username || user.displayName, user.displayName);
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  const handleSendEmailInvite = async (targetEmail: string) => {
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSendingInviteMail(true);
    try {
      const res = await sendEmailInviteWithLink({
        toEmail: targetEmail,
        senderName: currentUser.displayName,
        senderUsername: publicProfile?.username,
        senderUid: currentUser.uid,
      });

      if (res.success) {
        setInviteMailSent(true);
        showToast({
          type: 'success',
          message: `Invitation ready for ${targetEmail}!`,
        });
      } else {
        showToast({
          type: 'error',
          message: res.error || 'Failed to send invite email.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: err.message || 'Error sending invite email.',
      });
    } finally {
      setIsSendingInviteMail(false);
    }
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast({ type: 'success', message: 'Invite link copied to clipboard!' });
  };

  const handleShareWhatsApp = () => {
    const text = `Salam! Connect with me on Hisaab to track shared expenses, split bills, and manage balances easily: ${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Hisaab',
          text: `Salam! Connect with me on Hisaab to track shared expenses and balances:`,
          url: inviteUrl,
        });
        showToast({ type: 'success', message: 'Invite link shared!' });
      } catch (_) {}
    } else {
      handleCopyInviteLink();
    }
  };

  const handleOpenGmailWeb = (targetEmail?: string) => {
    const to = targetEmail || '';
    const subject = `Join ${currentUser.displayName} on Hisaab (Expense Tracker)`;
    const body = `Salam!\n\nI have invited you to connect on Hisaab to track shared expenses, split bills, and settle balances easily.\n\nAccept invitation and connect here:\n${inviteUrl}\n\nLooking forward to managing expenses together!`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    showToast({ type: 'success', message: 'Opening Gmail Compose...' });
  };

  const handleOpenMailto = (targetEmail?: string) => {
    const to = targetEmail || '';
    const subject = `Join ${currentUser.displayName} on Hisaab (Expense Tracker)`;
    const body = `Salam!\n\nI have invited you to connect on Hisaab to track shared expenses, split bills, and settle balances easily.\n\nAccept invitation and connect here:\n${inviteUrl}\n\nLooking forward to managing expenses together!`;
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      window.location.href = mailto;
    } catch (_) {
      window.open(mailto, '_self');
    }
    showToast({ type: 'success', message: 'Opening your default mail app...' });
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Add Friend">
      <div className="space-y-4">
        {/* 2-tab segmented control */}
        <Segmented
          options={[
            { value: 'search', label: 'Search User' },
            { value: 'invite', label: 'Invite & Share Link' },
          ]}
          value={tab}
          onChange={setTab}
          fullWidth
        />

        {/* TAB 1: Search Registered Users */}
        {tab === 'search' && (
          <div className="space-y-3.5">
            <Input
              placeholder="Search by @username or email (e.g. friend@gmail.com)..."
              leftIcon={<Search className="w-4 h-4" />}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />

            {isSearching && (
              <p className="text-xs text-center py-4 text-[var(--mu)]">Searching users...</p>
            )}

            {/* Found Users List */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                <p className="text-[11px] font-bold text-[var(--mu)] px-1">
                  Matching registered users:
                </p>
                {searchResults.map((user) => (
                  <div
                    key={user.uid}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar name={user.displayName} photoURL={user.photoURL} size="md" />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-[var(--tx)] truncate">
                          {user.displayName}
                        </h4>
                        <p className="text-xs text-[var(--mu)] truncate">
                          {user.username ? `@${user.username}` : user.email || 'User'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendRequest(user)}
                      className="btn sm shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* If searched email or query not found as registered user */}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[var(--tx)]">
                    No registered user found for &quot;{searchQuery}&quot;
                  </p>
                  <p className="text-[11px] text-[var(--mu)]">
                    {isEmailSearch || searchQuery.includes('@')
                      ? 'This person has not joined Hisaab yet. Send them an invite link via Web Share or WhatsApp to connect instantly!'
                      : 'Send them an invite link via WhatsApp, Web Share, or Email to connect with your profile.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="btn sm justify-center cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share Web Link
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="btn s sm justify-center cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#2EF2A0]" /> WhatsApp
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-[11px]">
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="text-[#2EF2A0] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy invite URL
                  </button>
                  <button
                    type="button"
                    disabled={isSendingInviteMail}
                    onClick={() => handleSendEmailInvite(searchedEmail || searchQuery.trim())}
                    className="text-[var(--mu)] hover:text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {isSendingInviteMail ? 'Sending email...' : 'Send via Email'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Direct Shareable Link & Instant Email Invite */}
        {tab === 'invite' && (
          <div className="space-y-4 py-1">
            {/* Quick Share Link Box */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#A855F7]/20 text-[#C084FC] flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[var(--tx)]">
                    Direct Shareable Link
                  </h4>
                  <p className="text-[11px] text-[var(--mu)]">
                    Anyone opening this link connects directly with your profile.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.08] text-xs font-mono break-all select-all text-[var(--tx)]">
                {inviteUrl}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="btn sm justify-center cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </button>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="btn s sm justify-center cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#2EF2A0]" /> WhatsApp
                </button>
              </div>
            </div>

            {/* Direct Email Invite Form */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2EF2A0]/15 text-[#2EF2A0] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--tx)]">
                    Send Email Invitation
                  </h4>
                  <p className="text-[11px] text-[var(--mu)]">
                    Send an invite with your link so your friend joins and connects automatically.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <Input
                  type="email"
                  placeholder="friend@gmail.com"
                  value={searchedEmail || ''}
                  onChange={(e) => {
                    setSearchedEmail(e.target.value);
                    setInviteMailSent(false);
                  }}
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSendingInviteMail}
                    onClick={() => handleSendEmailInvite(searchedEmail || '')}
                    className="btn sm flex-1 justify-center cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" /> {isSendingInviteMail ? 'Sending...' : 'Send Email Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenGmailWeb(searchedEmail || '')}
                    className="btn s sm flex-1 justify-center cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Gmail Web
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--mu)] px-1 pt-0.5">
                  <span>Using another client?</span>
                  <button
                    type="button"
                    onClick={() => handleOpenMailto(searchedEmail || '')}
                    className="text-[#2EF2A0] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Open Default Mail App</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {inviteMailSent && (
                  <div className="p-3 rounded-xl bg-[#2EF2A0]/15 border border-[#2EF2A0]/30 text-center space-y-1">
                    <p className="text-xs font-bold text-[#2EF2A0]">
                      ✓ Invitation ready for {searchedEmail}!
                    </p>
                    <p className="text-[11px] text-[var(--mu)]">
                      When your friend opens the link or signs up with this email, they will connect with your account automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Native Share button */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="btn s sm w-full justify-center cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Share via Other Apps...
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
};
