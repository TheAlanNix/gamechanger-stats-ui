# GameChanger Stats UI

A modern web application for viewing player and team statistics from GameChanger leagues.

## Features

- **Player Statistics**: View individual player batting, pitching, and fielding stats
- **Team Leaders**: Leaderboards for top performers in key statistical categories
- **Filtering**: Adjustable minimum thresholds for plate appearances, innings pitched, and fielding opportunities
- **Team Stats**: View runs scored and runs allowed per game for each team
- **Organization Selection**: Easily switch between different leagues/organizations
- **Responsive Design**: Clean, modern UI built with Next.js and shadcn/ui

## Project Structure

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and shadcn/ui components
- **Backend**: FastAPI Python server using gamechanger-client library
- **Caching**: In-memory TTL-based caching for improved performance

## Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- GameChanger API token

### Getting Your Token

To use this application, you need a GameChanger API token:

1. Log into [GameChanger](https://gc.com) in your web browser
2. Open your browser's Developer Tools (F12 or Right Click → Inspect)
3. Go to the Application/Storage tab
4. Look under Cookies for `gc.com`
5. Find the cookie named `token` and copy its value
6. This is your `GC_TOKEN`

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set your GameChanger token as an environment variable:
```bash
export GC_TOKEN="your_token_here"  # On Windows: set GC_TOKEN=your_token_here
```

4. Run the backend server:
```bash
python main.py
```

The backend API will be available at http://localhost:8000

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:3000

## Usage

1. Start the backend server (from `backend/` directory):
```bash
cd backend
source venv/bin/activate
export GC_TOKEN="your_token_here"
python main.py
```

2. In a new terminal, start the frontend (from project root):
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser
4. Select an organization from the dropdown
5. Explore the stats across different tabs:
   - **Leaders**: Top performers and team stats
   - **Batting**: Individual batting statistics
   - **Pitching**: Individual pitching statistics
   - **Fielding**: Individual fielding statistics

## Features in Detail

### Leaderboards
- Top 5 players in each category (expandable to 20)
- Batting: AVG, RBI, SLG, HR, OBP, Hits
- Pitching: ERA, WHIP, Strike %, Strikeouts, Innings Pitched, Wins
- Team: Runs per game, Runs allowed per game

### Filtering
- Adjustable minimum thresholds (default 20% of league average)
- Filters synchronized across leaderboards and tables
- Batting: Minimum plate appearances
- Pitching: Minimum innings pitched
- Fielding: Minimum fielding opportunities

### Statistics
All stats are calculated from GameChanger's API:
- **Batting**: Games, AB, PA, H, 2B, 3B, HR, RBI, BB, SO, AVG, OBP, SLG
- **Pitching**: Games, IP (MLB format), H, R, ER, BB, SO, ERA, WHIP, Strike %
- **Fielding**: Games, Fielding Opportunities, PO, A, E, DP, Fielding %
- **Team**: Games Played, Runs Scored/Allowed, Per-Game Averages

### Data Flow
1. Backend fetches teams from selected organization
2. For each team, retrieves season stats and player info
3. Calculates derived statistics (AVG, ERA, WHIP, etc.)
4. Fetches team records for team-level stats
5. Results cached (1 hour for orgs, 10 minutes for stats)

## API Endpoints

- `GET /api/organizations` - Get all available organizations
- `GET /api/stats/{organization_id}` - Get all stats for an organization
- `GET /api/health` - Health check endpoint

## Technologies

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.8+
- **API Client**: gamechanger-client library
- **Caching**: In-memory TTL cache

## Development

### Project Dependencies
- `gamechanger-client`: Python library for GameChanger API
- `fastapi`: Web framework for the backend API
- `uvicorn`: ASGI server for running FastAPI
- Next.js, React, and shadcn/ui components for the frontend

### Key Implementation Details
- Innings pitched displayed in MLB format (5.1 for 5⅓ innings)
- Strike percentage calculated from GameChanger's `S%` stat
- Games pitched uses `GP:P` key, games fielded uses `GP:F`
- Team avatars displayed throughout the UI
- Unknown players filtered out automatically
