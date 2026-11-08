# Bingo Duo — 2-player real-time Bingo

This is a mobile-friendly web app starter. It supports two players in a room, manual 5×5 boards, alternating turns, shared called numbers, and BINGO checks across 5 rows, 5 columns, and 2 diagonals.

## Important setup: Firebase is required for multiplayer

The project is not connected to a Firebase project yet. You must add your own Firebase web configuration.

1. Open https://console.firebase.google.com and create a project.
2. Add a **Web App** to the project.
3. Copy the Firebase config values into `firebase.js`.
4. In Firebase Console, open **Authentication → Sign-in method** and enable **Anonymous**.
5. Open **Realtime Database**, create a database, and choose a region.
6. In Realtime Database → Rules, paste the contents of `database.rules.json` and publish.
7. Serve this folder from a web server (not by opening `index.html` as a `file://` URL).

## Run it

For a quick local test on a computer, use any static server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

For two phones on different networks, deploy the folder to a static host such as Firebase Hosting, GitHub Pages, or Netlify. Share the deployed URL and the six-character room code with the second player.

## How to play

1. Player 1 creates a room and shares its code.
2. Player 2 joins using that code.
3. Each player manually fills all 25 cells with the numbers 1–25, each exactly once.
4. Both players tap **I'm ready**.
5. Player 1 starts. Players alternate turns, selecting one number from 1–25.
6. Every selected number is marked on both boards.
7. A player can claim BINGO after completing any full row, column, or either diagonal.

## Notes and limitations

- Every player enters all 25 numbers manually; there is no automatic grid generation.
- The current starter uses client-side game logic and permissive authenticated room writes for a quick prototype. Do not treat it as cheat-proof or production-secure. For a public release, move move validation, turn enforcement, board validation, and winner verification into trusted server code (for example Cloud Functions) and tighten Realtime Database rules.
- Room cleanup, reconnect UX, rematch flow, and robust host-disconnect handling are not implemented yet.
- Both players must use the same deployed app URL and Firebase project.
