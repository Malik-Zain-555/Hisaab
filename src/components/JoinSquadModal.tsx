import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KeyRound, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { Sheet, Button } from '../ui';

interface JoinSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinSquadModal: React.FC<JoinSquadModalProps> = ({ isOpen, onClose }) => {
  const { joinSquadByInviteCode, showToast } = useApp();
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inviteCode.trim().toUpperCase();
    if (!clean) {
      showToast({ type: 'error', message: 'Please enter an invite code.' });
      return;
    }

    setIsSubmitting(true);
    const res = await joinSquadByInviteCode(clean);
    setIsSubmitting(false);

    if (res.success) {
      setInviteCode('');
      onClose();
    } else {
      showToast({ type: 'error', message: res.error || 'Failed to join squad.' });
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Join Group with Invite Code">
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        <div className="text-center p-4 bg-[#F8FAFC] dark:bg-[#151D30] rounded-3xl border border-[#E2E8F0] dark:border-[#202B45] space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-[#1E2642] text-[#4F46E5] flex items-center justify-center mx-auto shadow-xs">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#101828] dark:text-[#F8FAFC]">
              Enter Group Invite Code
            </h4>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-xs mx-auto">
              Squad groups are private. Enter the invite code shared by the squad admin to join.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC] block mb-1.5">
            Invite Code
          </label>
          <input
            type="text"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="e.g. SQD-9K2M"
            className="w-full bg-[#F8FAFC] dark:bg-[#151D30] border border-[#CBD5E1] dark:border-[#263353] rounded-2xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-[#101828] dark:text-[#F8FAFC] uppercase focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
          />
        </div>

        <div className="pt-2 flex items-center gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isSubmitting}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Join Squad
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
