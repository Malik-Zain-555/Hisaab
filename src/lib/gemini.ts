import { GoogleGenAI, Type, Schema } from '@google/genai';

export interface ParsedItem {
  type: 'expense' | 'ledger';
  date: string;
  title: string;
  amount: number;
  category: 'Food' | 'Snacks' | 'Rent' | 'Study' | 'Transport' | 'Personal' | 'Other';
  paidBy: 'me' | 'friend';
  friendName?: string;
  splitWith?: string[];
  splitAmounts?: { [friend: string]: number };
  ledgerType?: 'owes' | 'adjustment' | 'payment';
  note?: string;
  ambiguous?: boolean;
  warning?: string;
}

export interface ParseResult {
  items: ParsedItem[];
  rawSummary: string;
}

/**
 * Fallback deterministic parser for offline or quick regex matching
 */
export function localParseExpenseNote(text: string): ParsedItem[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: ParsedItem[] = [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
  const currentDayNum = String(now.getDate()).padStart(2, '0');
  let currentDate = `${currentYear}-${currentMonthNum}-${currentDayNum}`;
  let isReturnSection = false;

  for (const line of lines) {
    // Check for date headers like "8-Oct", "3 Oct", "08/10", "October 8"
    const dateMatch = line.match(/^(\d{1,2})[-/ ]+(oct|october|nov|dec|sep|jan|feb|mar|apr|may|jun|jul)?[-/ ]*(\d{2,4})?/i);
    if (dateMatch && !line.includes(':') && !line.includes('=')) {
      const day = dateMatch[1].padStart(2, '0');
      // If month text is present, extract month number, else current month
      const monthMap: { [k: string]: string } = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const mStr = dateMatch[2] ? monthMap[dateMatch[2].toLowerCase().slice(0, 3)] || currentMonthNum : currentMonthNum;
      const yStr = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : String(currentYear);
      currentDate = `${yStr}-${mStr}-${day}`;
      isReturnSection = false;
      continue;
    }

    if (line.toLowerCase().includes('return from') || line.toLowerCase().includes('ledger')) {
      isReturnSection = true;
      continue;
    }

    // Try parsing lines like "Nashta: 340" or "Fruit Chaat 150" or "Rent 7000"
    // or "Ehtisham: 260+200" or "Aqeel owes me: 125, 170"
    if (isReturnSection || line.toLowerCase().includes('owes') || line.toLowerCase().includes('adjustment')) {
      // Ledger entry line
      const friendMatch = line.match(/^([a-zA-Z\s]+)(?::|owes me:?|\-)\s*([0-9\+\-\s,]+)(.*)$/i);
      if (friendMatch) {
        const friend = friendMatch[1].trim();
        const amountsPart = friendMatch[2].trim();
        const extraNote = (friendMatch[3] || '').trim();

        // Calculate sum if expression like 260+200
        const terms = amountsPart.split(/[\+]/).map((t) => parseFloat(t.trim())).filter((n) => !isNaN(n));
        const totalAmount = terms.reduce((a, b) => a + b, 0);

        results.push({
          type: 'ledger',
          date: currentDate,
          title: extraNote || `Ledger update from note`,
          amount: totalAmount,
          category: 'Other',
          paidBy: 'me',
          friendName: friend,
          ledgerType: totalAmount < 0 ? 'adjustment' : 'owes',
          note: line,
        });
        continue;
      }
    }

    // Standard expense line: "Item name: 300" or "Item name 300"
    const expenseMatch = line.match(/^([^:\d]+)(?::|\s)\s*(-?\d+[\d\.,]*)(.*)$/);
    if (expenseMatch) {
      const title = expenseMatch[1].trim();
      const amount = Math.abs(parseFloat(expenseMatch[2].replace(/,/g, '')));
      const note = (expenseMatch[3] || '').trim();

      // Guess category
      let category: ParsedItem['category'] = 'Food';
      const lowTitle = title.toLowerCase();
      if (lowTitle.includes('chaat') || lowTitle.includes('kulfi') || lowTitle.includes('biscuit') || lowTitle.includes('samosa') || lowTitle.includes('coffee') || lowTitle.includes('chai')) {
        category = 'Snacks';
      } else if (lowTitle.includes('rent')) {
        category = 'Rent';
      } else if (lowTitle.includes('print') || lowTitle.includes('blockchain') || lowTitle.includes('book') || lowTitle.includes('study')) {
        category = 'Study';
      } else if (lowTitle.includes('bikeya') || lowTitle.includes('uber') || lowTitle.includes('indrive') || lowTitle.includes('petrol')) {
        category = 'Transport';
      } else if (lowTitle.includes('eraser') || lowTitle.includes('personal') || lowTitle.includes('cloth')) {
        category = 'Personal';
      }

      // Check if friend name is in the note or title
      let friendName: string | undefined = undefined;
      let ambiguous = false;
      let warning: string | undefined = undefined;

      if (lowTitle.includes('ehtisham') || note.toLowerCase().includes('ehtisham')) {
        friendName = 'Ehtisham';
      }
      if (lowTitle.includes('aqeel') || note.toLowerCase().includes('aqeel')) {
        friendName = friendName ? `${friendName}, Aqeel` : 'Aqeel';
      }

      if (note.includes('split') || note.includes('me') && note.includes('/')) {
        ambiguous = true;
        warning = 'Contains custom split terms. Review split shares before importing.';
      }

      results.push({
        type: 'expense',
        date: currentDate,
        title,
        amount,
        category,
        paidBy: note.toLowerCase().includes('paid by') ? 'friend' : 'me',
        friendName,
        note: note ? note.replace(/^[\(\s\-]+|[\)\s]+$/g, '') : undefined,
        ambiguous,
        warning,
      });
    }
  }

  return results;
}

/**
 * Uses Gemini AI with structured schema to parse daily expense notes
 */
export async function parseDailyNoteWithGemini(
  noteText: string,
  friendsList: string[] = ['Ehtisham', 'Aqeel']
): Promise<ParseResult> {
  const apiKey =
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    '';

  // If no apiKey or client-side direct call fails, seamlessly fall back to local deterministic parser
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const localItems = localParseExpenseNote(noteText);
    return {
      items: localItems,
      rawSummary: `Parsed ${localItems.length} items using local smart pattern analyzer.`,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonthName = now.toLocaleString('en-US', { month: 'long' });
    const todayStr = `${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const prompt = `
You are an expert expense parser for the Pakistani expense tracker "Hisaab".
Parse this daily raw expense text note into structured items.
Friends known in the group: ${friendsList.join(', ')}.
Today's actual calendar date is ${todayStr}.
Default year is ${curYear}, default month is ${curMonthName}.
If date is relative or omitted, use ${todayStr}.
Dates written like "8-Oct", "3 Oct" should resolve to "${curYear}-10-08", "${curYear}-10-03".

Text Note to Parse:
"""
${noteText}
"""

Identify each individual expense and ledger entry.
Flag anything ambiguous or with complex splits with ambiguous=true and a warning explanation so the user can review before importing.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['expense', 'ledger'] },
                  date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                  title: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  category: {
                    type: Type.STRING,
                    enum: [
                      'Food',
                      'Snacks',
                      'Rent',
                      'Study',
                      'Transport',
                      'Personal',
                      'Other',
                    ],
                  },
                  paidBy: { type: Type.STRING, enum: ['me', 'friend'] },
                  friendName: { type: Type.STRING },
                  ledgerType: {
                    type: Type.STRING,
                    enum: ['owes', 'adjustment', 'payment'],
                  },
                  note: { type: Type.STRING },
                  ambiguous: { type: Type.BOOLEAN },
                  warning: { type: Type.STRING },
                },
                required: ['type', 'date', 'title', 'amount', 'category', 'paidBy'],
              },
            },
            summary: { type: Type.STRING },
          },
          required: ['items'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return {
      items: parsedJson.items || [],
      rawSummary: parsedJson.summary || `Parsed ${parsedJson.items?.length || 0} items successfully.`,
    };
  } catch (error) {
    console.warn('Gemini structured parser fallback:', error);
    const fallbackItems = localParseExpenseNote(noteText);
    return {
      items: fallbackItems,
      rawSummary: `Parsed ${fallbackItems.length} items using local smart pattern analyzer.`,
    };
  }
}
