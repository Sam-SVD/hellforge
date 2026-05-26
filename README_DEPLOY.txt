HELLFORGE 8 - RENDER MULTIPLAYER BUILD

What this is:
- Single-player restored build with the shotgun put back to the simpler original style.
- Multiplayer 1v1 arena with no monsters.
- Invite-code rooms using a small Node + WebSocket server.
- Weapons: pistol, shotgun, rifle.
- Controls: WASD, mouse aim, click/space shoot, 1/2/3 switch weapons, Q/right-click aim.

How to run locally:
1. Install Node.js.
2. Open this folder in a terminal.
3. Run:
   npm install
   npm start
4. Open:
   http://localhost:3000

How to deploy on Render:
1. Make a new GitHub repo.
2. Upload these files/folders:
   package.json
   server.js
   public/
3. On Render, create a new Web Service from the repo.
4. Build Command:
   npm install
5. Start Command:
   npm start
6. After it deploys, open the Render URL.
7. Click Multiplayer, create a room, and send your friend the invite link/code.

Important:
- This is not static-only. Multiplayer needs the Node server.
- The free Render plan may spin down when inactive, so the first load can be slow.
