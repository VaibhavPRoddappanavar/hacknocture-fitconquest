# FitConquest

FitConquest is a full-stack fitness app prototype with a Next.js frontend and an Express + MongoDB backend. The project currently contains two main experiences:

- Feature 1: a daily activity map focused on Bengaluru with location search, walk/cycle filtering, and a dedicated leaderboard page.
- Feature 2: squad-based squat challenges with login, team joining, challenge state transitions, leaderboards, and Socket.IO-powered live score updates.

The repository is organized as a small monorepo with separate frontend and backend applications.

## Project Overview

### Frontend

The frontend is built with:

- Next.js 16
- React 19
- TypeScript
- Leaflet for the interactive map UI
- Socket.IO client for live challenge updates

Key UI routes:

- `/`: landing page with navigation to the main features
- `/feature1`: daily map experience
- `/feature1/leaderboard`: dedicated leaderboard page for the map feature
- `/feature2`: squad challenges dashboard
- `/feature2/[id]`: real-time challenge arena
- `/feature2/leaderboard`: leaderboard page for challenge rankings

### Backend

The backend is built with:

- Express 5
- MongoDB with Mongoose
- JWT authentication
- bcryptjs for password hashing
- Socket.IO for real-time challenge events

Backend API base path:

- `/api/auth`
- `/api/challenges`
- `/api/leaderboard`

## Repository Structure

```text
hacknocture-fitconquest/
  backend/
    index.js
    seed.js
    models/
      User.js
      Challenge.js
    routes/
      auth.js
      challenges.js
      leaderboard.js
  frontend/
    app/
      page.tsx
      layout.tsx
      feature1/
      feature2/
    public/
```

## Feature Summary

### Feature 1: Daily Map

Feature 1 is currently a frontend-driven experience.

What it includes:

- OpenStreetMap-based Leaflet map
- Bengaluru-centered default view
- Search input with place suggestions using Nominatim geocoding
- Walk / Cycle filter toggle
- Dedicated leaderboard page separate from the map page
- Daily-only map view

Important implementation note:

- The map markers and leaderboard data for Feature 1 are currently driven by shared frontend mock data in `frontend/app/feature1/data/leaderboardData.ts`.
- The place search is real geocoding against OpenStreetMap Nominatim.
- Feature 1 does not currently persist its map activity data to the backend.

### Feature 2: Squad Challenges

Feature 2 is the more backend-connected part of the app.

What it includes:

- Login flow using demo seeded users
- Challenge listing screen
- Join Red / Join Blue team flow
- Host-controlled challenge start flow
- Real-time squat count broadcasting via Socket.IO
- Leaderboard page filtered by global, state, or city

The challenge flow is backed by MongoDB and real-time server events.

## Data Model

### User

Defined in `backend/models/User.js`.

Fields:

- `username`: unique login handle
- `password`: hashed password
- `friends`: references to other users
- `location.city`
- `location.state`
- `location.country`
- `stats.totalSquats`
- `stats.challengesWon`

Indexes are defined for leaderboard-style queries by city, state, and total squat count.

### Challenge

Defined in `backend/models/Challenge.js`.

Fields:

- `title`
- `startTime`
- `endTime`
- `status`: `upcoming`, `active`, or `completed`
- `targetSquats`
- `teams[]`
- `host`
- `winnerTeam`

Each challenge contains two teams with member references and running squat totals.

## API Reference

### Auth Routes

Base path: `/api/auth`

#### `POST /api/auth/login`

Authenticates a user with username and password.

Request body:

```json
{
  "username": "vishal",
  "password": "password123"
}
```

Response:

- JWT token
- basic user payload

#### `GET /api/auth/me`

Returns the currently authenticated user.

Required header:

```text
Authorization: Bearer <token>
```

### Challenge Routes

Base path: `/api/challenges`

#### `GET /api/challenges`

Returns all challenges with populated host and team members.

#### `GET /api/challenges/:id`

Returns one challenge by id.

#### `POST /api/challenges/:id/join`

Adds a user to a selected team.

Request body:

```json
{
  "userId": "<user-id>",
  "teamName": "Red"
}
```

#### `POST /api/challenges/:id/start`

Starts a challenge if the requester is the host and both teams have at least one member.

Request body:

```json
{
  "userId": "<host-user-id>"
}
```

### Leaderboard Route

Base path: `/api/leaderboard`

#### `GET /api/leaderboard`

Supported query params:

- `type=global`
- `type=state&value=Kerala`
- `type=city&value=Kochi`
- `type=daily`
- `type=weekly`
- `type=monthly`

Current limitation:

- Daily, weekly, and monthly are visual variants only right now.
- The backend currently stores cumulative squat totals, not timestamped squat logs.
- The route changes result limits for those time windows rather than calculating true time-bounded scores.

## Socket.IO Events

The backend Socket.IO server is initialized in `backend/index.js`.

Server-side events handled:

- `join_challenge`
- `start_challenge`
- `squat_performed`
- `disconnect`

Server-side broadcasts:

- `challenge_started`
- `score_update`
- `challenge_completed`

The `squat_performed` event updates both:

- the selected challenge team total
- the user’s cumulative squat count

## Environment Variables

### Backend `.env`

Expected variables:

```env
MONGO_URI=mongodb://localhost:27017/fitconquest
JWT_SECRET=replace_this_with_a_strong_secret
PORT=5000
```

### Frontend `.env`

Expected variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Notes:

- If `NEXT_PUBLIC_API_URL` is not set, some current frontend pages fall back to `http://localhost:8080` while the backend defaults to port `5000`.
- For local development, set `NEXT_PUBLIC_API_URL=http://localhost:5000` to keep frontend and backend aligned.

## Local Development Setup

### 1. Install dependencies

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
cd backend
npm install
```

### 2. Configure environment variables

Create or update:

- `backend/.env`
- `frontend/.env`

Use the variable examples from the section above.

### 3. Seed the database

From the backend folder:

```bash
node seed.js
```

This will:

- clear existing users and challenges
- create demo users
- connect every demo user as friends
- create one default challenge

### 4. Start the backend

From the backend folder:

```bash
node index.js
```

For auto-reload during development:

```bash
npx nodemon index.js
```

### 5. Start the frontend

From the frontend folder:

```bash
npm run dev
```

### 6. Open the app

Frontend:

- `http://localhost:3000`

Backend:

- `http://localhost:5000`

## Demo Credentials

The seed script creates the following users with the same password:

- `vishal`
- `arjun`
- `priya`
- `rahul`
- `testuser`

Password:

```text
password123
```

## Scripts

### Frontend

Defined in `frontend/package.json`:

- `npm run dev`: start Next.js dev server
- `npm run build`: create production build
- `npm run start`: serve production build
- `npm run lint`: run ESLint

### Backend

Defined in `backend/package.json`:

- `npm test`: placeholder test command

Important note:

- The backend does not currently define dedicated `dev` or `start` npm scripts.
- Use `node index.js` or `npx nodemon index.js` directly.

## Current Known Issues

### Frontend lint status

The frontend lint setup currently reports pre-existing issues in Feature 2 pages, including:

- `any`-typed values
- hooks referencing functions before declaration
- missing hook dependencies

These are existing codebase issues and are not specific to the README.

### API base URL mismatch

Some Feature 2 frontend files fall back to `http://localhost:8080`, while the backend server defaults to `5000`.

Recommended fix for local development:

- always define `NEXT_PUBLIC_API_URL=http://localhost:5000` in `frontend/.env`

### Time-based leaderboard behavior

The backend leaderboard route accepts `daily`, `weekly`, and `monthly`, but does not yet compute real time-windowed totals because user squat activity is not logged by timestamp.

## Recommended Next Improvements

High-value next steps for the project:

1. Add backend `dev` and `start` scripts in `backend/package.json`.
2. Normalize frontend API URL fallbacks so every page uses the same backend port.
3. Replace `any` usage in Feature 2 with proper TypeScript types.
4. Add per-event squat logs so daily/weekly/monthly leaderboards become real.
5. Persist Feature 1 map activity data to the backend instead of using frontend mock data.
6. Add tests for auth, challenge join/start rules, and leaderboard filters.

## Tech Stack Snapshot

Frontend:

- Next.js 16.1.6
- React 19.2.3
- TypeScript 5
- Leaflet 1.9.4
- Socket.IO client 4.8.3

Backend:

- Express 5.2.1
- Mongoose 9.3.0
- Socket.IO 4.8.3
- JWT
- bcryptjs

## Ownership Note

This README is written against the current checked-in codebase and documents the project as it exists now, including current limitations and rough edges.