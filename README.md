# Tmates CLI

Lightweight Tmates command line client for interacting with your AI teammates.

## Installation

```bash
npm install -g tmates-cli
```

## Configuration

Before using the CLI, you need to set up your environment variables. Copy the `.env.example` file to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

- `TMATES_SUPABASE_URL` - Your Supabase project URL
- `TMATES_SUPABASE_ANON_KEY` - Your Supabase anonymous key  
- `TMATES_API_BASE_URL` - Your Tmates API base URL

## Usage

### Interactive Mode

Start the interactive CLI:

```bash
tmates
# or
tmates start
```

### Command Line Mode

Login:

```bash
tmates login
```

Check status:

```bash
tmates status
```

Logout:

```bash
tmates logout
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm test
```
