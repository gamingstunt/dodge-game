# GamingStunt: Impossible Dodge

## Overview

GamingStunt: Impossible Dodge is a Reddit Devvit app that embeds a self-contained HTML5 arcade mini-game inside an interactive post. Players move a blue square left and right, dodge red falling obstacles, and try to survive as long as possible while the game speed ramps up every 5 seconds.

The project is intentionally simple, mobile-friendly, and policy-safe:

- No personal data collection
- No analytics or tracking scripts
- No cookies
- No login prompts or permission requests
- One embedded game page served from local public assets

## Project Structure

```text
devvit-app/
├── devvit.yaml
├── package.json
├── README.md
├── main.tsx
├── public/
│   ├── index.html
│   ├── gamestyles.css
│   └── logo.png
├── src/
│   └── components/
│       └── GameFrame.tsx
├── LICENSE
├── PRIVACY.md
├── TERMS.md
└── tsconfig.json
```

## Installation

1. Install Node.js 22 or newer.
2. Install the Devvit CLI.
3. Log in with your Reddit developer account.
4. Install project dependencies.

```bash
npm install
devvit login
```

## Run Locally with Devvit CLI

Start a playtest session against your development subreddit:

```bash
devvit playtest <your-test-subreddit>
```

Or, if you prefer npm scripts:

```bash
npm run playtest -- <your-test-subreddit>
```

During playtest, Reddit will hot-reload app changes as you edit the files.

## Publish to Reddit

1. Upload a new app build:

```bash
devvit upload
```

2. Verify the app in your test subreddit.
3. Publish when ready:

```bash
devvit publish
```

## Branding Disclaimer

GamingStunt branding appears in the embedded game header and in-game footer only as informational attribution.

This branding:

- Does not imply Reddit endorsement
- Does not track users
- Does not alter gameplay or moderation flows
- Exists only to identify the game developer

## Policy Compliance Notes

- The app does not collect, store, process, or share personal data.
- The app does not use cookies, analytics beacons, advertising pixels, or third-party scripts.
- The only external URL is `https://gamingstunt.com`, exposed as an informational outbound link.
- The game is fully playable without account linking, purchases, or permissions.
- The interactive experience is bundled locally and runs from the app's public assets.

## About the Developer

This game is developed by GamingStunt.  
Visit [https://gamingstunt.com](https://gamingstunt.com) for more games.  
All branding is informational only.
