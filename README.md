# BABCOCK PREP — Phase 1 MVP (VSC + GitHub + Render Ready)

Responsive black + electric-blue React frontend and Express/Prisma/PostgreSQL backend built directly on top of your starter codebase, matching the Phase 1 blueprint scope:
- **Student Gate:** Sign up with auto-generated Student ID (`BP/JSS1A/XXXXXX`), class-locked dashboard (JSS1–SS3), live subjects, Learning World (notes/videos/audio), live CBT Exam Hall (countdown timer, calculator, flag questions, auto-submit on timeout, anti-tab-switch warning + auto-submit after 2 leaves, instant grading + explanations), and My Results.
- **Teacher & Admin Gate:** Create & publish Learning Materials, create & publish CBT Exams, add CBT questions (A–D + explanations), and view all student submissions.
- **Parent Gate:** Link child via Student ID (`BP/...`) and view child's CBT results and performance average.
- **Render Blueprint (`render.yaml`):** One-click deploy for PostgreSQL + Node API + Static Frontend.

## Local Run in VS Code (VSC)
1. **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   # Update DATABASE_URL and JWT_SECRET (min 32 chars) in .env
   npm install
   npx prisma generate
   npx prisma db push
   npm run seed
   npm run dev
   ```
2. **Frontend (new terminal):**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

## Demo Accounts (created automatically by `npm run seed`)
- **Admin:** `admin@babcockprep.edu.ng` / `AdminPass123!`
- **Teacher:** `teacher@babcockprep.edu.ng` / `TeacherPass123!`
- **Student (JSS1 A):** `student@babcockprep.edu.ng` / `StudentPass123!` (ID: `BP/JSS1A/000001`)
- **Parent:** `parent@babcockprep.edu.ng` / `ParentPass123!`

## Deploy on GitHub + Render
1. Push the `babcock-prep` folder to a GitHub repository.
2. In Render, click **New + -> Blueprint**, select your repo, and Render will read `render.yaml` to create `babcock-prep-db`, `babcock-prep-api`, and `babcock-prep-web`.
3. Once both services deploy, set `FRONTEND_ORIGIN` on `babcock-prep-api` to your frontend URL (e.g. `https://babcock-prep-web.onrender.com`) and `VITE_API_URL` on `babcock-prep-web` to `https://babcock-prep-api.onrender.com/api`, then trigger a manual redeploy of the frontend.
