# Hisaab (حساب) - Real-Time Shared Expense Tracker

Hisaab is a production-ready, mobile-first shared expense tracker for close friends and flatmates. It replaces manual text notes with live running balance ledgers, automated Gmail notification cards, Google Drive statement backups, and Gemini AI-powered Smart Paste note parsing.

## Key Features
- **Real-Time Synchronized Ledgers**: Powered by Cloud Firestore `onSnapshot` listeners. Balances are always computed dynamically from immutable ledger entries.
- **Monthly Wallet & Budgeting**: Track monthly budgets, carry-over from prior months, opening balance, and fixed bills (e.g. flat rent). Live calculation of daily burn rate and projected end-of-month balance.
- **Under 5-Second Quick Add**: Floating action button with one-tap repeat cards, recent title autocomplete, and split options (Equal, Custom, Friend Owes Full).
- **Gemini AI Smart Paste**: Paste unstructured daily WhatsApp/text notes (e.g., `8-Oct\nNashta: 340\nReturn From Friends: Ehtisham: 260+200`). Structured JSON schema parses items with ambiguity warnings into an editable preview table before import.
- **Friend Ledger & Settlement Flow**: Itemized statements per friend with adjustments (+/-). Friend taps "I paid Rs X" to claim settlement, and Owner confirms to update ledger balances and trigger email confirmations.
- **Gmail Notifications**: Integrates directly with the Gmail API (`gmail.send`) to dispatch branded HTML notification cards and Nudge reminders to friends with current running balances.
- **Google Drive Statement Backups**: Exports statements as CSV and PDF directly into the user's personal Google Drive (`drive.file`).
- **Real-Time Group Chat & Engagement**: In-app chat room, inline discussion comments on expenses/ledgers, and emoji reactions (👍 ❤️ 😂 😮 🙏).
- **Tokenized Public Statement Links**: Share revocable read-only links (`?statement=<friendId>`) or formatted WhatsApp text notes (`https://wa.me/?text=...`) without requiring login.
- **Zero-Trust Security**: Hardened `firestore.rules` deployed via RPC to strictly protect user accounts and prevent unauthorized mutations.
