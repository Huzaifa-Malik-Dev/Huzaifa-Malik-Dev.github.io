# Project Stack: MERN
# Copy to project root, rename to CLAUDE.md, fill in Project Details.

## Project Details
- Project name: 
- MongoDB DB name: 
- PM2 process name: 
- Nginx location block: /app-name/
- Servers and their ports:
  - server1.js — port: 
  - server2.js — port: 
  - (add more as needed)

## Folder Structure
```
app/ or frontend/
  public/
  components/
  utils/

server/ or backend/
  models/
  middlewares/
  routes/
  utils/
  public/
  server1.js
  server2.js
  ...
```

## Backend Rules
- Pure JavaScript Node.js + Express — no TypeScript, no build step
- Each server is its own file (server1.js, server2.js, etc.) — not a single entry point
- Each server started individually: pm2 start server1.js --name <name>
- All environment values via .env
- One route file per resource in /routes
- try/catch in every route, console.error for errors
- Centralized error middleware acceptable alongside per-route handling
- Both client and server side validation on all inputs
- axios on frontend for all HTTP calls

## Database
- MongoDB + Mongoose
- Model files in /models, PascalCase singular naming
- This project uses its own dedicated MongoDB database — never share across projects

## Deployment
- DigitalOcean + Nginx + PM2
- Huzaifa deploys by manually transferring files via WinSCP — no git workflow
- Always ask for a free port before writing any server or Nginx config
- Nginx location block routing only — never root /
- Always generate a ready-to-paste .env file at the end of any setup task

## Nginx Template
```nginx
location /<app-name>/ {
    proxy_pass http://localhost:<port>/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

## PM2 Commands
```
pm2 start server1.js --name <name>
pm2 reload <name>
pm2 logs <name>
```

## Frontend Rules
- React functional components with hooks only — no class components
- useState default, useContext sparingly, store2 for persistence
- Shopify-style bottom-center toast queue for all user feedback
- Red toast = error, dark toast = info

## .env File
At the end of any backend setup, always generate a complete ready-to-paste .env:
```
PORT=
MONGO_URI=
JWT_SECRET=
(add all required variables)
```

## Do NOT
- No TypeScript
- No npm install without being asked
- No class based React components
- No hardcoded domains, ports, or secrets
- No shared MongoDB databases across projects
