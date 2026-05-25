# 1. Init project
mkdir slime-dungeon-server && cd slime-dungeon-server
npm init -y

# 2. Install dependencies
npm i express ws uuid

# 3. Run server
PORT=3000 node server.js

# 4. For development with auto-reload
npm i -D nodemon
npx nodemon server.js
