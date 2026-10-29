import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  X,
  Check,
  Search,
  Sparkles,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { Sheet, Button, Input, Avatar } from '../ui';

interface CreateSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_OPTIONS = [
  '👥', '⚡', '🚀', '💰', '🛡️', '🎯', '🔥', '🏆',
  '💎', '💼', '🤝', '🌟', '🍕', '🏕️', '✈️', '🎮'
];

export const CreateSquadModal: React.FC<CreateSquadModalProps> = ({ isOpen, onClose }) => {
  const { createSquadGroup, friends, currentUser, showToast } = useApp();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('👥');
  const [whoCanPost, setWhoCanPost] = useState<'all_members' | 'admins_only'>('all_members');
  const [selectedFriendUids, setSelectedFriendUids] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredFriends = friends.filter((f) =>
    (f.displayName || '').toLowerCase().includes(friendSearch.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(friendSearch.toLowerCase())
  );

  const toggleFriend = (uid: string) => {
    setSelectedFriendUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast({ type: 'error', message: 'Please enter a squad group name.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createSquadGroup({
        name: cleanName,
        description: description.trim(),
        avatarIcon: selectedEmoji,
        initialMemberUids: selectedFriendUids,
      });
      // Reset form
      setName('');
      setDescription('');
      setSelectedEmoji('👥');
      setSelectedFriendUids([]);
      setFriendSearch('');
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Failed to create group.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Create New Group">
      <form onSubmit={handleCreate} className="space-y-5 pb-6">
        {/* Avatar & Basic Info */}
        <div className="flex items-center gap-4 p-4 rounded-3xl bg-[#F8FAFC] dark:bg-[#151D30] border border-[#E2E8F0] dark:border-[#202B45]">
          <div className="w-16 h-16 rounded-3xl bg-white dark:bg-[#1E2742] border border-[#CBD5E1] dark:border-[#334155] flex items-center justify-center text-3xl shadow-sm shrink-0">
            {selectedEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Flatmates, Goa Trip, Office Squad"
              className="w-full bg-white dark:bg-[#0E1526] border border-[#CBD5E1] dark:border-[#263353] rounded-2xl px-3 py-2 text-sm font-semibold text-[#101828] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
            />
          </div>
        </div>

        {/* Emoji Selector */}
        <div>
          <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] block mb-2">
            Select Group Icon
          </label>
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                className={`h-10 rounded-2xl flex items-center justify-center text-xl transition cursor-pointer border ${
                  selectedEmoji === emoji
                    ? 'bg-[#EEF2FF] dark:bg-[#202B4B] border-[#4F46E5] scale-105 shadow-xs'
                    : 'bg-[#F8FAFC] dark:bg-[#151D30] border-[#E2E8F0] dark:border-[#202B45] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] block mb-1.5">
            Description <span className="text-[#94A3B8] font-normal">(optional)</span>
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group for? (e.g. Shared grocery expenses)"
          />
        </div>

        {/* Invite Friends */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">
              Invite Friends ({selectedFriendUids.length} selected)
            </label>
            <span className="text-[11px] text-[#64748B]">They'll receive an in-app invite</span>
          </div>

          {friends.length > 0 ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Search friends..."
                  className="w-full bg-[#F8FAFC] dark:bg-[#151D30] border border-[#E2E8F0] dark:border-[#202B45] rounded-2xl pl-9 pr-3 py-1.5 text-xs text-[#101828] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {filteredFriends.map((friend) => {
                  const isChecked = selectedFriendUids.includes(friend.uid);
                  return (
                    <div
                      key={friend.uid}
                      onClick={() => toggleFriend(friend.uid)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition cursor-pointer select-none ${
                        isChecked
                          ? 'bg-[#EEF2FF] dark:bg-[#1E2642] border-[#4F46E5]'
                          : 'bg-[#F8FAFC] dark:bg-[#151D30] border-[#E2E8F0] dark:border-[#202B45] hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          photoURL={friend.photoURL}
                          name={friend.displayName}
                          size="sm"
                        />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-[#101828] dark:text-[#F8FAFC] truncate">
                            {friend.displayName}
                          </p>
                          {friend.email && (
                            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                              {friend.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                          isChecked
                            ? 'bg-[#4F46E5] border-[#4F46E5] text-white'
                            : 'border-[#CBD5E1] dark:border-[#475569] bg-white dark:bg-[#0E1526]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#64748B] italic p-3 bg-[#F8FAFC] dark:bg-[#151D30] rounded-2xl text-center">
              No connected friends yet. You can still invite anyone later via group invite code or link!
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isSubmitting}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Create Squad
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
