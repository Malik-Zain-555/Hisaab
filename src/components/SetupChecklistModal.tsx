import React from 'react';
import {
  ShieldCheck,
  Mail,
  Database,
  Globe,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Sheet, Button } from '../ui';

export const SetupChecklistModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { firebaseAuthUser } = useApp();

  const checklistItems = [
    {
      title: 'Cloud Firestore & Enterprise database',
      desc: 'Real-time onSnapshot listeners and persistent local cache.',
      done: true,
      icon: Database,
    },
    {
      title: 'Zero-trust security rules deployed',
      desc: 'firestore.rules deployed via DeployRules RPC. Part A shareLinks and Part B accounts guarded.',
      done: true,
      icon: ShieldCheck,
    },
    {
      title: 'Gmail reminders (gmail.send)',
      desc: 'OAuth client configured. Automated email notifications send to friends when expenses are updated.',
      done: Boolean(firebaseAuthUser),
      icon: Mail,
    },
    {
      title: 'Secure statement links (?s=<token>)',
      desc: '43-character base64url tokens from crypto.getRandomValues. Fails closed if missing or revoked.',
      done: true,
      icon: Globe,
    },
  ];

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="System checklist">
      <div className="space-y-4">
        <p className="text-xs text-[var(--mu)]">
          Integrations, zero-trust security rules, and active scopes
        </p>

        <div className="space-y-2.5">
          {checklistItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-3.5 bg-white/[0.04] border border-[var(--line)] rounded-2xl flex items-start gap-3"
              >
                <div className="mt-0.5 text-[var(--em)]">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-[var(--tx)]">
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        item.done
                          ? 'bg-[var(--em)]/15 text-[var(--em)]'
                          : 'bg-[var(--su)]/20 text-[var(--su)]'
                      }`}
                    >
                      {item.done ? 'Active' : 'Pending login'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--mu)] mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2">
          <Button fullWidth variant="outline" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
