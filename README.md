# Hisaab

Hisaab is a mobile-first shared expense tracker for friends, roommates, and families. It helps users record expenses, keep running balances, settle dues, and communicate about shared spending from a single app.

## Features

- Real-time shared ledger tracking
- Expense history with filters by category, person, and date
- Monthly budget and carry-over tracking
- Friend-wise settlement and balance updates
- In-app chat and direct messages
- Smart paste support for WhatsApp-style expense notes
- PDF/CSV export and shareable statements
- Push notifications and email invitations
- PWA-friendly experience for mobile and web

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Express server
- Firebase Auth and Firestore
- Google Gemini AI integration
- Progressive Web App support

## Project Structure

- `src/` – frontend application and UI
- `server.ts` – Express API and app server
- `public/` – static assets and PWA files
- `firestore.rules` – Firestore security rules
- `package.json` – app scripts and dependencies
- `.env.example` – environment variable template

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   bun install
   ```

2. Copy the environment example file and add your required values:
   ```bash
   cp .env.example .env
   ```

3. Start the app:
   ```bash
   npm run dev
   ```

4. Open the app in your browser at the local URL reported by Vite/Express.

## Useful Scripts

- `npm run dev` – start the app in development mode
- `npm run build` – build the production bundle
- `npm run preview` – preview the production build
- `npm run lint` – TypeScript check

## Notes

This project is designed around real-time expense management for group finances, with a focus on simple tracking, fast reconciliation, and friendly balance visibility between participants.
