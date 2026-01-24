# Portfolio Blend - Investment Portfolio Tracker

A comprehensive portfolio tracking application that consolidates investments from multiple sources including Zerodha, INDMoney, and Mutual Funds.

## Features

- **Multi-Source Integration**: Connect Zerodha via OAuth, upload INDMoney Excel reports, and sync Mutual Funds via PAN
- **Real-time Portfolio Analytics**: Track total invested value, current value, P&L, and returns
- **Asset Class Breakdown**: View holdings by Equity, ETF, Mutual Funds, US Stocks, REIT, and SGB
- **Sector & Source Allocation**: Visualize portfolio distribution across sectors and data sources
- **AI-Powered Insights**: Get intelligent portfolio recommendations and analysis
- **Portfolio Snapshots**: Capture and compare portfolio performance over time
- **Auto-refresh**: Keep your portfolio data up-to-date automatically

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn-ui, Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Edge Functions, Authentication)
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase account and project

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd portfo-blend

# Install dependencies
npm install

# Set up environment variables
# Create a .env file with your Supabase credentials:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Start the development server
npm run dev
```

### Database Setup

1. Run the migrations in the `supabase/migrations` directory
2. Deploy Edge Functions from `supabase/functions`
3. Configure Zerodha API credentials in Supabase secrets

## Usage

1. **Sign up/Login**: Create an account or log in
2. **Connect Data Sources**:
   - Connect Zerodha via OAuth for automatic sync
   - Upload INDMoney Excel reports
   - Sync Mutual Funds using your PAN number
3. **View Portfolio**: Analyze your consolidated portfolio across all sources
4. **Capture Snapshots**: Save portfolio states for historical comparison
5. **Get AI Insights**: Receive personalized portfolio recommendations

## Deployment

Deploy to Vercel, Netlify, or any static hosting platform:

```sh
npm run build
```

The build output will be in the `dist` directory.
