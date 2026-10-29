# Hisaab UI/UX Redesign & Simplification Plan

Complete ground-up redesign of Hisaab from generic purple styling to a modern **Obsidian & Emerald** financial design system, replacing confusing budget formulas with real Khata Net balances, eliminating redundant clutter, and updating typography, icons, and micro-animations.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified in Turn 1 and guide this entire redesign:

- **Confirmed Aesthetic**: **Obsidian & Emerald** — Deep obsidian canvas (`#080C14`), dark structural card surfaces (`#0E1626` / `#152238`), neon emerald primary accents (`#10B981`), crisp white/light gray typography (`#F8FAFC`), and clean light mode counterpart.
- **Confirmed Hero Balance**: **Real Khata Net** — The top hero card now displays the real net balance between what friends owe you versus debts you owe to friends, eliminating the artificial "Cash in hand = Budget - Spent" number.
- **Removed Clutter (What and Why)**:
  - **Pace Diagnosis (`Rs 293/day allowance`, `Spending Above Pace`)**: *Removed* — Caused confusion with arbitrary daily pacing quotas.
  - **Budget Carryover Math (`+ -Rs 2,485 carryover`)**: *Removed* — Negative carryover formulas distorted user spending figures.
  - **Buggy "133% of spend" Category Alert**: *Removed* — Division anomalies caused misleading alerts (>100%). Replaced with a clean, accurate category breakdown.
  - **Redundant Hero Nudge & Share buttons**: *Removed from hero card* — Nudge is already accessible right on the specific friend's card where it makes semantic sense.

---

## 1. Overview & Core Concept

- **What It Does**: A real-time shared expense tracker, khata ledger, and bill-splitting platform for friends, roommates, and groups with transparent debt clearance and verified receipt proofs.
- **Core Problem Solved**: Users were confused by synthetic "Cash in hand" budget metrics that showed money they did not physically possess, coupled with clutter and visual noise.
- **Key Value**: Instant, trustworthy clarity on who owes whom, zero visual fluff, frictionless debt settlement with proof verification, and a modern financial interface.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme Tokens

```css
/* Design System: Obsidian & Emerald */
:root {
  /* Light Theme */
  --canvas: #F8FAFC;
  --surface: #FFFFFF;
  --surface-raised: #F1F5F9;
  --ink: #0F172A;
  --muted: #64748B;
  --border: #E2E8F0;
  --primary: #059669;
  --primary-hover: #047857;
  --emerald-glow: rgba(16, 185, 129, 0.15);
  --money-in: #059669;
  --money-out: #E11D48;
}

.dark {
  /* Dark Theme: Deep Obsidian & Emerald */
  --canvas: #080C14;
  --surface: #0E1626;
  --surface-raised: #152238;
  --ink: #F8FAFC;
  --muted: #94A3B8;
  --border: #1B2942;
  --primary: #10B981;
  --primary-hover: #34D399;
  --emerald-glow: rgba(16, 185, 129, 0.22);
  --money-in: #10B981;
  --money-out: #FB7185;
}
```

### Typography System
- **Display & Headings**: `Outfit` and `Plus Jakarta Sans` for clean, geometric structure with high legibility.
- **Body & Prose**: `DM Sans` for scannable UI copy and labels.
- **Metrics & Currency**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for rock-solid vertical alignment of PKR amounts.

### Key Screen Layouts & User Flows

1. **Dashboard (Home)**:
   - **Hero Card — Real Khata Net**:
     - Large tabular net number: `+Rs 3,679` (in emerald when friends owe you, or `-Rs X` in coral when you owe).
     - Sub-indicators: `Friends Owe You: Rs 3,679` and `You Owe Friends: Rs 0`.
     - Action buttons: Quick `+ Add Expense` and `Settle Balance / Pay Debt`.
   - **Friends & Contacts Carousel**:
     - Clean modern circular avatars with subtle status borders (emerald ring = owes you; coral ring = you owe; neutral = settled).
     - Quick `+ Add Friend` button opening in-place friend discovery without tab jumping.
   - **Monthly Spend Snapshot**:
     - Clean overview of total personal expenses logged this month and transaction count (without confusing pace diagnosis or carryover math).
   - **Recent Activity Feed**:
     - Chronological list of latest splits and settlements with receipt thumbnails and amount tags.

2. **History View**:
   - Clean date-grouped timeline with search, category filtering, and friend filter.
   - Friend filter accurately displays their personal share in each bill.

3. **Friends & Ledger Detail (`FriendLedgerSheet` & `FriendLedgerView`)**:
   - Itemized transaction ledger with proof-of-payment receipts.
   - 2-step settlement modal: select payment method (JazzCash, EasyPaisa, SadaPay/NayaPay, Bank, Cash), attach receipt image, review before confirming.

4. **Navigation**:
   - **Desktop**: Sleek obsidian sidebar (width 260px) with icons, clean active tabs, and unread badges.
   - **Mobile**: Floating bottom dock with glassmorphism blur and elevated action trigger.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Replace 'Cash in hand' with 'Khata Net Balance' in the Hero Card**
  - *Chosen Approach*: The hero card calculates and displays `totalFriendsOweMe - totalIOweFriends`.
  - *Why*: Solves the primary user complaint: *"the showed balance up there? what the hell? I think it only showed when I have that money I mean when received from friend."*
  - *Alternative Considered*: Showing both artificial budget and net khata in two separate cards. Rejected because it doubles visual clutter.

- **Decision 2: Remove Pace Diagnosis and Carryover Calculations**
  - *Chosen Approach*: Completely strip `actualSpendFraction > expectedSpendFraction * 1.15`, daily allowance pace diagnosis, and negative carryover math.
  - *Why*: Users found these confusing and reported them as broken/unnecessary. Monthly spend is now simply the sum of actual approved expenses.

- **Decision 3: Modern Obsidian & Emerald Design vs Cookie-Cutter Templates**
  - *Chosen Approach*: Custom deep dark theme with emerald accents, hairline borders (`#1B2942`), and custom micro-animations (smooth page enter, tactile button press).
  - *Why*: Eliminates the previous generic purple gradient aesthetic and gives the application a distinctive, premium fintech identity.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Top Navigation                        │
│  [Logo Wordmark]  ───  [Month Selector]  ───  [Bell / User] │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────────┐               ┌─────────────────────┐
│  Desktop Sidebar Nav  │               │   Mobile Dock Nav   │
│  Home / History / DMs │               │   (Floating Bottom) │
└───────────────────────┘               └─────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Main Viewport                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Hero Card: Real Khata Net Balance                   │  │
│  │   [+Rs 3,679 Owed to you]                             │  │
│  │   • Friends owe: Rs 3,679   • You owe: Rs 0           │  │
│  │   [+ Add Expense]  [Settle / Pay Debt]                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Friends & Contacts Row (+ Add Friend in-place)      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Monthly Spend Summary (Clean, no pace quotas)       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Recent Transactions & Split Bills                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Modals & Interactive Sheets                  │
│  • QuickAddModal (Expense Split)                            │
│  • KhataSettlementModal (2-Step Review & Receipt Upload)    │
│  • FriendLedgerSheet (Itemized Hisaab)                      │
│  • AddFriendModal (Username / Invite)                       │
└─────────────────────────────────────────────────────────────┘
```

### Components to Update & Redesign
1. `src/index.css` & `index.html`: Update design tokens to Obsidian & Emerald, import Google Fonts (`Outfit`, `DM Sans`, `JetBrains Mono`), configure smooth startup animation.
2. `src/ui/Card.tsx`, `Button.tsx`, `Input.tsx`, `Modal.tsx`, `Sheet.tsx`: Restyle with new dark obsidian surfaces, emerald accents, and hairline borders.
3. `src/components/Dashboard.tsx`: Overhaul the hero card to Real Khata Net balance, remove pace diagnosis, carryover math, and broken 133% alert.
4. `src/components/Navbar.tsx` & `Navigation.tsx`: Restyle top bar and desktop/mobile navbars with new palette, crisp icons, and zero-pill discipline.
5. `src/components/HistoryView.tsx` & `FriendLedgerSheet.tsx`: Apply obsidian & emerald styling, tabular numerals, and receipt lightbox previews.

---

## Verification Plan

- Run `compile_applet` to confirm zero compilation errors.
- Run `lint_applet` to ensure TypeScript compliance and zero unused imports.
- Verify the hero card calculates strictly `friendsOweMe - iOweFriends` without synthetic budget subtraction.
- Verify all clutter (pace diagnosis, carryover math, 133% alert, redundant hero buttons) is completely removed.
- Restart dev server to verify smooth startup and live rendering.
