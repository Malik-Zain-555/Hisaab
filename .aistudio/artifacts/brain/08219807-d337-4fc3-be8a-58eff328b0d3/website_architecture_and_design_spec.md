# Hisaab — Complete Website & UI/UX Architecture Document

> **Purpose of this Document**: This document outlines every single screen, section, card, button, modal, and feature currently built into the application. Review how each part works, what information it displays, and how it is organized. You can then provide your exact design instructions (colors, typography, layout, animations, components, card styles) so we can completely rebuild it to your vision.

---

## 1. Executive Summary & Core Identity

- **Application Name**: **Hisaab** (حساب)
- **What It Does**: A real-time shared expense tracker, khata ledger, and bill-splitting platform for roommates, friends, travel squads, and personal finance.
- **Core Value**:
  1. Real khata accounting (who owes you vs. who you owe).
  2. Multi-person bill splitting (equal, exact, percentage, or custom share).
  3. Verifiable debt clearance (2-step settlements with payment channels and receipt screenshots).
  4. Real-time chat & activity hub (1-on-1 private messaging, squad groups, voice notes).

---

## 2. Global Layout & Navigation Architecture

The app has a single root container with three persistent navigation elements:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP NAVBAR: [Brand Logo] [Month Selector] ──────── [Install] [Bell] [Avatar] │
├────────────────────────────┬───────────────────────────────────────────┤
│ DESKTOP SIDEBAR (≥1024px): │ MAIN VIEWPORT (Max-w 1152px)              │
│                            │                                           │
│  [+ Add Expense] (Primary) │  Active Tab Content:                      │
│                            │   • Home (Dashboard)                      │
│  [🏠 Home]                 │   • History (Timeline & Search)           │
│  [🕒 History]              │   • Chats & Friends (Squad + DMs)         │
│  [💬 Chats & Friends]      │                                           │
│                            │                                           │
├────────────────────────────┴───────────────────────────────────────────┤
│ MOBILE DOCK (<1024px): [Home] ─── [+] Elevated Center ─── [History] ── [Chats]│
└────────────────────────────────────────────────────────────────────────┘
```

### Components in Navigation:
1. **Top Navbar (`Navbar.tsx`)**:
   - **Brand Logo & Wordmark**: Icon avatar with online indicator ping + "Hisaab Shared Ledger" title.
   - **Month Selector**: Dropdown to switch between current and past 12 months (e.g., `October 2026`, `September 2026`). Changing this updates all monthly metrics and expense feeds instantly.
   - **PWA Install Button**: Pill-shaped button prompting users on mobile or desktop to install the app.
   - **Notification Bell**: Shows unread counter badge. Clicking opens a dropdown with tabs ("Unread" vs "All"), displaying friend requests, expense mentions, payment confirmations, and a "Clear All" button.
   - **User Menu**: Shows user avatar, display name, `@username`, and quick links to Profile Settings, Wallet Setup, and Sign Out.

2. **Desktop Sidebar (`Navigation.tsx`)**:
   - Persistent on wide screens (≥1024px, 256px wide).
   - High-priority **`+ Add Expense`** CTA button at the top.
   - Tab buttons: **Home**, **History**, **Chats & Friends** (with badge counter for incoming friend requests).

3. **Mobile Floating Dock (`Navigation.tsx`)**:
   - Floating glassmorphic dock anchored at the bottom on screens `<1024px`.
   - Elevated center **`+`** button with gradient styling for instant expense logging with one thumb.

---

## 3. Screen 1: Dashboard (`Dashboard.tsx`)

The default landing page. It is structured into 7 distinct functional blocks:

### Block 1: Hero Card — Real Khata Net Balance
- **Main Metric**: Big tabular currency figure (e.g. `+Rs 3,679` in green/emerald when you are owed money, or `-Rs 1,200` in coral/rose when you are in debt).
- **Status Badge**: Top-right tag showing `"Receivable from Friends"` / `"Payable Debt to Friends"` / `"All Balances Settled"`.
- **Sub-Metric Cards (2 columns)**:
  - *Friends Owe You*: Total sum owed to you by active contacts.
  - *You Owe Friends*: Total sum you owe to your friends.
- **Hero Actions**:
  - `+ Add Expense`: Triggers the expense creation sheet.
  - `Pay Debt / Settle`: Opens the Khata Settlement Hub pre-filtered to debts you owe.
  - `Wallet Settings`: Opens the monthly target and fixed bills manager.

### Block 2: Friends & Contacts Carousel
- Horizontal scrollable row displaying all active friends.
- Circular avatars with status rings:
  - **Green ring**: Friend owes you money.
  - **Red ring**: You owe friend money.
  - **No ring**: Settled (zero balance).
- Clicking any friend opens their full **Friend Ledger Sheet** with transaction history and settlement tools.
- **`+ Add` button**: Triggers the Add Friend modal (by username search or invite link).

### Block 3: Monthly Expense Snapshot (Personal Spending)
- Clean 3-card summary grid for the selected month:
  1. **Personal Spent**: Total sum of personal expenses + your exact split shares in shared bills, plus transaction count.
  2. **Top Category**: Category with highest expenditure (e.g., `Food & Dining — 42% of total`).
  3. **Monthly Target / Limit**: Configured monthly budget target (e.g., `Rs 50,000` with percentage used and remaining buffer).

### Block 4: Khata Settlement Hub (Quick Settlement Cards)
- 3 clickable cards for fast settlement exploration:
  1. *Friends Owe You Card*: Shows total receivable + "View ➔" link.
  2. *You Owe Friends Card*: Shows total payable + "Pay ➔" link.
  3. *Net Balance Card*: Shows net overall balance.
- Clicking any card opens the interactive **Khata Settlement Modal**.

### Block 5: Recent Transactions Feed
- List of the 5 most recent transactions for the selected month.
- Each row shows:
  - Category icon with distinct colored badge.
  - Expense title + meal item tag (e.g. `🍽️ Pizza & Coke`) if provided.
  - Date + payer tag (`"Paid by you"` vs `"Paid by Ali"`).
  - Khata split badge (e.g. `"+Rs 600 owed to you"` or `"You owe Rs 300"`).
  - Total expense amount in tabular font.
  - Click row opens the **Transaction Detail Modal**.

### Block 6: "This Week" Daily Spending Chart
- 7 rounded vertical bar indicators representing Sunday through Saturday of the current week.
- Clicking any day highlights that bar and reveals the exact spend total for that specific day.

### Block 7: Category Breakdown & Fixed Bills
- **Category Breakdown**: Proportional visual progress bars for each category (`Food & Dining`, `Transport`, `Housing & Rent`, `Groceries`, `Utilities`, `Entertainment`, `Shopping`, `Other`).
- **Fixed Bills & Monthly Commitments Tracker**:
  - Recurring monthly bills (e.g., `Rent`, `Internet`, `Gym`).
  - Interactive checkboxes to toggle bills between `"Paid"` and `"Due"`.

---

## 4. Screen 2: History & Search View (`HistoryView.tsx`)

The complete financial archive and search engine.

### Header & Controls
- **Search Bar**: Real-time keyword filter across titles, notes, food items, and locations.
- **Category Chips**: Filter by `Food`, `Transport`, `Rent`, `Groceries`, `Utilities`, etc.
- **Person Filter**: Filter by `Everyone` or by specific friend. When a specific friend is selected, a dedicated banner calculates their **exact personal spending share** across bills (not just the total bill size).
- **Trash Toggle**: Switch between active transactions and the Trash Bin.
- **Export PDF Button**: Generates and downloads a clean, printable monthly PDF statement.

### Timeline List
- Expenses grouped chronologically by date headers (e.g., `Today`, `Yesterday`, `Monday, Oct 12`).
- Each item includes:
  - Category icon.
  - Title, meal note (`🍽️`), situation/occasion (`📍`), and time tag.
  - Split subtitle: who owes what, or `"Personal"`.
  - Receipt thumbnail: clicking opens a full-screen **Lightbox Modal**.
  - Right-aligned amount (in coral/rose).
  - Hover action: Move to trash (with an instant **Undo Toast**).
- Clicking any transaction opens the **Transaction Detail Modal** to view splits or edit details.

---

## 5. Screen 3: Chats & Friends Hub (`ChatRoom.tsx`)

A hybrid communication and ledger messenger with two tabs:

### Tab A: Personal Chats & Direct Contacts (1:1 DMs)
- Left sidebar of friends with real-time balance previews (e.g., `Owes you Rs 1,400`).
- Chat message feed with:
  - Text messages with timestamps and read receipts.
  - **Inline Money / Expense Cards**: Directly shows a split bill or payment card embedded inside the chat bubble.
  - **Voice Notes**: In-app audio recorder that captures and plays voice messages with an animated waveform visualizer.
  - **Image / Receipt Attachments**: Share camera photos or receipts.
  - **Message Editing & Deletion**: Edit sent messages inline or delete them.
- Message Input Bar:
  - Emoji picker, photo attachment button, money card trigger, text input, and microphone / send button.

### Tab B: Squad / Group Chat
- Real-time group chat for roommates, travel groups, or family.
- Group-wide expense announcements (e.g. `Ali added Dinner: Rs 4,800. Your share: Rs 1,200`).
- Squad management modal (rename squad, add members, copy invite link).

---

## 6. Screen 4: Friend Ledger & Statements (`FriendLedgerView.tsx` & `FriendLedgerSheet.tsx`)

The dedicated accounting ledger between you and any specific friend:

### 1. Header & Identity
- Friend name, avatar, `@username`, and email.
- Current live balance:
  - `Rs +X` (Emerald): Friend owes you money.
  - `Rs -X` (Rose): You owe friend money.
  - `Rs 0`: Settled.

### 2. 3-Stat Friend Spending Breakdown
- **Friend's Total Spending**: Real sum of what they've paid and split with you.
- **Shared Bills Count**: Total number of shared transactions.
- **Total Cleared / Settled**: Historical sum of debts successfully cleared.

### 3. Action Toolbar
- **Settle Balance / Pay Debt**: Opens the 2-step settlement review modal.
- **Add Ledger Entry**: Manually log an adjustment or direct loan.
- **Share Public Statement Link**: Generates an external link that anyone can open without logging in to view the live statement.
- **Send WhatsApp / Email Reminder**: Auto-fills a polite message with amount and link.
- **Remove Friend**: Deletes friend connection while preserving historical expense data.

### 4. 2-Step Settlement Review Flow
- **Step 1 — Setup**:
  - Payment Direction: `I paid [Friend]` vs. `[Friend] paid me`.
  - Amount in PKR.
  - Channel: EasyPaisa, JazzCash, Nayapay/Sadapay, Raast, Bank Transfer, Cash.
  - Transaction Reference / TID #.
  - Camera / Screenshot upload: attaches payment receipt with client-side image compression.
- **Step 2 — Verification & Audit Confirmation**:
  - Review summary showing payer, recipient, channel, TID, and verified receipt preview.
  - Confirmation records an immutable payment entry in the ledger and updates balances.

---

## 7. Global Modals & Sheets

1. **QuickAddModal (`QuickAddModal.tsx`)**:
   - Huge amount input with quick increment chips (`+100`, `+500`, `+1,000`, `+5,000`).
   - Title input with category selector (Food, Travel, Rent, etc.).
   - Split Options:
     - `Me Only` (Personal expense).
     - `Split Equally` (Splits between you and selected friends).
     - `Exact Amounts` (Specify exact PKR per person).
     - `Paid by Me` vs `Paid by Friend`.
   - Meal details (`What was eaten?`, `Time/Meal`, `Occasion`).
   - Receipt photo attachment via camera or file picker.

2. **WalletSettings (`WalletSettings.tsx`)**:
   - Configure monthly spending target.
   - Add/edit fixed recurring bills (Rent, Internet, Electricity, Subscriptions).

3. **ProfileSetupModal (`ProfileSetupModal.tsx`)**:
   - First-time username claim (`@username`).
   - Display name and payment details (EasyPaisa/JazzCash phone number for quick payments).

4. **PublicStatementView (`PublicStatementView.tsx`)**:
   - Clean, read-only web view accessible via share link (`?s=token`) without login. Allows roommates or friends to verify statement entries on any device.

5. **NudgeModal (`NudgeModal.tsx`)**:
   - Pre-formatted WhatsApp reminder generator with customizable tone (Polite, Casual, Direct).

---

## 8. Data Architecture & Persistence

- **State Management**: Centralized React Context (`AppContext.tsx`) with optimistic local UI updates and real-time Firestore synchronization.
- **Offline First**: IndexedDB offline persistence enabled; transactions made while disconnected sync automatically on reconnect.
- **Data Collections**:
  - `users`: User profiles, usernames, FCM push tokens.
  - `months`: Monthly budget configs and recurring fixed bills.
  - `expenses`: Transactions with splits, payer IDs, receipt URLs, meal notes, and timestamps.
  - `ledgerEntries`: Direct debt settlements, payments, receipts, and manual adjustments.
  - `messages`: Real-time chat messages, audio recordings, and inline money cards.
  - `notifications`: Push and in-app alerts for splits and payments.

---

## 9. Current Design System Tokens

```css
Canvas (Dark): #080C14  |  Canvas (Light): #F8FAFC
Surface Card (Dark): #0E1626  |  Surface Card (Light): #FFFFFF
Surface Raised: #152238  |  Border: #1B2942 / #E2E8F0
Primary Accent: #10B981 (Neon Emerald)
Money In (Owed to you): #10B981 (Emerald)
Money Out (You owe): #FB7185 / #E11D48 (Rose)
Fonts: Heading = Outfit / Plus Jakarta Sans | Body = DM Sans | Numbers = JetBrains Mono
```

---

## 10. Design Blueprint: How You Can Customize It

To tell me exactly how you want the website redesigned, you can provide guidelines for any or all of the following:

1. **Color Palette & Vibe**:
   - What colors should dominate? (e.g., Pure OLED Pitch Black, Midnight Navy, Cyberpunk Neon, Minimalist Monochrome, Warm Slate, Luxury Gold & Carbon, etc.)
   - Accent color for primary buttons and positive balances?
   - Accent color for debts and negative numbers?

2. **Hero Card & Dashboard Layout**:
   - How should the top card look? (Glassmorphism card, compact floating header, minimal typography-focused balance, or split dashboard?)
   - What order should the sections appear in? (e.g. Balance -> Recent Activity -> Friends -> Charts, or something else?)

3. **Card & Component Styles**:
   - Sharp corners (`rounded-none` or `rounded-md`) vs. Ultra-soft rounded corners (`rounded-3xl`)?
   - Flat borders with subtle glow, or heavy card backgrounds with shadows?
   - Button styles: Solid filled, outline with neon borders, compact pill buttons, or full-width actions?

4. **Typography & Font Feel**:
   - Modern Tech (Inter, Geist, Satoshi)?
   - Bold Geometric (Outfit, Syne, Cabinet Grotesk)?
   - Minimalist Editorial (Playfair, Archivo, Space Grotesk)?

5. **Animations & Micro-interactions**:
   - Subtle fades, snappy spring physics, or ultra-minimal instant transitions?

---
*Ready for your exact design description! Share your preferred colors, layout changes, and visual direction, and it will be implemented directly.*
