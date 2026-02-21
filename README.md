# CodeEthnics Backend

Minimal Express + TypeScript boilerplate for the CodeEthnics backend.

This repository contains a small, testable web server written in TypeScript using Express. The app is split so `src/app.ts` configures the Express application and `src/server.ts` starts the HTTP listener. This makes it easy to run the app during development and import the app in tests without starting the server.

## Features
- Express server with CORS and JSON body parsing
- TypeScript-ready configuration
- Dev workflow using `ts-node-dev` for rapid local development

## Prerequisites
- Node.js (18+ recommended)
- pnpm (this project uses pnpm as package manager)

## Quick start (fish)
1. Install dependencies
   pnpm install

2. Start in development (auto-restarts on change)
   pnpm run dev

3. Build for production
   pnpm run build

4. Run production build
   pnpm start


## Environment
The server reads these environment variables:
- `PORT` — port to listen on (default: `5000`)

Provide an `.env` file in development or set the vars in your environment. Example is in `.env.example` (do not commit secrets).


