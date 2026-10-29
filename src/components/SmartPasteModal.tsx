import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { parseDailyNoteWithGemini, ParsedItem } from '../lib/gemini';
import {
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Sheet, Button, Card } from '../ui';
import { formatPKR } from '../lib/formatters';

interface SmartPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_NOTE_SNIPPET = `8-Oct
Nashta: 340
Coffee: 400
Samosa + Chai: 260 (Ehtisham treated but I paid)
Raat ka khana: 580
Return From Friends:
Ehtisham: 260+200
Aqeel: -363`;

export const SmartPasteModal: React.FC<SmartPasteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addExpense, addLedgerEntry, friends, currentUser, showToast } = useApp();

  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [summaryMessage, setSummaryMessage] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const friendsList = friends.map((f) => f.displayName);
      const res = await parseDailyNoteWithGemini(rawText, friendsList);
      setParsedItems(res.items);
      setSummaryMessage(res.rawSummary);
    } catch (err: any) {
      showToast({ type: 'error', message: 'Parsing failed: ' + err.message });
    } finally {
      setIsParsing(false);
    }
  };

  const removeItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleImportAll = async () => {
    if (parsedItems.length === 0) return;
    setIsImporting(true);

    try {
      for (const item of parsedItems) {
        if (item.type === 'expense') {
          await addExpense({
            title: item.title,
            amount: item.amount,
            category: item.category,
            date: item.date,
            paidBy: 'me',
            paidByName: currentUser.displayName,
            splitType: item.friendName ? 'friend_full' : 'personal',
            splits: item.friendName
              ? [
                  {
                    userId:
                      friends.find((f) => f.displayName.toLowerCase().includes(item.friendName!.toLowerCase()))
                        ?.uid || 'friend-unknown',
                    userName: item.friendName,
                    share: item.amount,
                  },
                ]
              : [],
            note: item.note,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName,
          });
        } else if (item.type === 'ledger' && item.friendName) {
          const friendObj = friends.find((f) =>
            f.displayName.toLowerCase().includes(item.friendName!.toLowerCase())
          );
          await addLedgerEntry({
            friendId: friendObj ? friendObj.uid : `custom-${item.friendName}`,
            friendName: item.friendName,
            date: item.date,
            label: item.title,
            amount: item.amount,
            type: item.amount < 0 ? 'payment' : 'owes',
            note: item.note,
            createdBy: currentUser.uid,
          });
        }
      }

      showToast({
        type: 'success',
        message: `Successfully imported ${parsedItems.length} records!`,
      });
      setParsedItems([]);
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: 'Import failed: ' + err.message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Smart Paste with Gemini">
      <div className="space-y-5">
        <p className="text-xs text-[#667085] dark:text-[#98A2B3]">
          Paste your daily handwritten or text expense note. Gemini parses item lines, math additions, and return amounts automatically.
        </p>

        {/* Text Area */}
        <div className="space-y-1.5">
          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your daily note here..."
            className="w-full bg-[#F4F5FA] dark:bg-[#0B0F1A] text-[#101828] dark:text-[#F2F4F7] font-mono text-xs p-3.5 rounded-2xl border border-[#E4E7EC] dark:border-[#232B3E] focus:outline-none focus:border-[#4F46E5] leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleParse}
            isLoading={isParsing}
            icon={<Sparkles className="w-4 h-4 text-amber-300" />}
          >
            Parse with Gemini
          </Button>
          <Button
            variant="outline"
            onClick={() => setRawText(SAMPLE_NOTE_SNIPPET)}
          >
            Load sample
          </Button>
        </div>

        {/* Parsed items table */}
        {parsedItems.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-[#E4E7EC] dark:border-[#232B3E]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold">Preview parsed entries ({parsedItems.length})</h4>
              <Button
                variant="primary"
                size="sm"
                onClick={handleImportAll}
                isLoading={isImporting}
              >
                Confirm & import all
              </Button>
            </div>

            <Card padding="none" className="divide-y divide-[#E4E7EC]/60 dark:divide-[#232B3E]/60 max-h-60 overflow-y-auto">
              {parsedItems.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#101828] dark:text-[#F2F4F7] truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#667085] truncate">
                      {item.date} • {item.category} {item.friendName ? `• ${item.friendName}` : ''}
                    </p>
                  </div>

                  <span className="font-extrabold text-sm tabular-nums shrink-0">
                    {formatPKR(item.amount)}
                  </span>

                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1 text-[#667085] hover:text-[#E5484D] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </Sheet>
  );
};
