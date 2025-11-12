# Tmates CLI

<!-- Badges -->

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6.svg)]()
[![Node](https://img.shields.io/badge/Node-18.17+-339933.svg)]()
[![npm](https://img.shields.io/badge/npm-Latest-CB3837.svg)]()
[![License](https://img.shields.io/badge/License-MIT-informational.svg)]()

## 1. Overview

Tmates CLI is a lightweight, interactive command-line interface for managing your AI teammates. Chat with agents, assign tasks, browse your pinboard, manage files, and configure settings—all from your terminal. Built with TypeScript and powered by Supabase authentication, the CLI provides a streamlined workflow for users who prefer keyboard-driven interfaces.

## 2. Key Features

- 🔐 **Passwordless Authentication** – Secure OTP-based login via Supabase
- 💬 **Interactive Chat** – Full-featured chat interface with thread management
- 🧑‍🤝‍🧑 **Agent Management** – Browse, hire, and dismiss AI teammates
- 📌 **Pinboard Access** – View and manage shared notes and summaries
- 📁 **File Browser** – List and access uploaded files
- ⚙️ **Settings Sync** – View user profile and mobile settings
- 🎨 **Rich Terminal UI** – Color-coded output with spinners and progress indicators
- 🔄 **Session Persistence** – Automatic token caching and refresh

## 3. Architecture Summary

The CLI is organized into clean, modular layers:

- **CLI Layer** (`src/cli/`) – Command parsing, interactive mode, UI components
- **Auth Layer** (`src/auth/`) – Supabase OTP authentication and session management
- **API Layer** (`src/api/`) – Type-safe HTTP client for Tmates Platform API
- **Config Layer** (`src/config/`) – Environment variable resolution and validation
- **Storage Layer** (`src/storage/`) – Local session token persistence

```
┌───────────────────────────────┐
│     Terminal Interface        │
│  (Commander.js + Readline)    │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│      CLI Application          │
│   Interactive / Commands      │
└───────────────┬───────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼────┐ ┌───▼────┐ ┌───▼────┐
│  Auth  │ │  API   │ │ Config │
│ (OTP)  │ │ Client │ │ Loader │
└───┬────┘ └───┬────┘ └────────┘
    │          │
    │   ┌──────▼──────┐
    └───►  Supabase   │
        │  + Tmates   │
        │   Platform  │
        └─────────────┘
```

## 4. Tech Stack

- **Language:** TypeScript 5.4+
- **Runtime:** Node.js 18.17+
- **CLI Framework:** Commander.js
- **UI Components:** Chalk (colors), Ora (spinners), CLI-Table3 (tables)
- **Authentication:** @supabase/supabase-js
- **Testing:** Vitest
- **Tooling:** ESLint, Prettier, tsx (dev runner)

## 5. Project Structure

```bash
tmates-cli/
  src/
    index.ts           # Entry point and error handling
    api/               # HTTP client and API endpoints
      http-client.ts   # Axios-based client with auth headers
      messages.ts      # Chat threads and messaging
      teammates.ts     # Agent store and management
      pinboard.ts      # Pinboard posts
      files.ts         # File listings
      profile.ts       # User profile
      settings.ts      # Mobile settings
    auth/              # Supabase authentication
      supabase-auth.ts # OTP flows, session management
    cli/               # Command-line interface
      app.ts           # Commander.js commands (login, logout, status)
      interactive.ts   # Interactive mode with navigation
      prompts.ts       # User input helpers
      layout.ts        # Terminal UI components
      theme.ts         # Color schemes
    config/            # Configuration management
      app-config.ts    # Environment variable resolution
    storage/           # Local storage
      session.ts       # Token persistence
  package.json
  tsconfig.json        # TypeScript configuration
  vitest.config.ts     # Test configuration
```

## 6. Getting Started

### 6.1 Prerequisites

- Node.js 18.17 or higher
- npm or yarn package manager
- A Tmates account (sign up at <https://tmates.app>)
- Access to a Tmates Platform instance (production or self-hosted)

### 6.2 Installation

#### Global Installation (Recommended)

```bash
npm install -g tmates-cli
```

After installation, the `tmates` command will be available globally:

```bash
tmates --version
```

#### Local Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/medhuelabs/tmates-cli.git
cd tmates-cli
npm install
```

### 6.3 Environment Configuration

The CLI requires connection details for your Tmates Platform instance. Create a `.env` file in your home directory or the CLI root:

```bash
# Required: Supabase project credentials
TMATES_SUPABASE_URL=https://your-project.supabase.co
TMATES_SUPABASE_ANON_KEY=eyJhbGc...

# Required: Tmates Platform API endpoint
TMATES_API_BASE_URL=https://api.tmates.app

# Optional: Disable session caching (for security-sensitive environments)
TMATES_CLI_DISABLE_SESSION_CACHE=0

# Optional: Enable debug logging
DEBUG=tmates-cli
```

**Environment Variable Reference:**

| Variable                           | Description                                              | Required |
| ---------------------------------- | -------------------------------------------------------- | -------- |
| `TMATES_SUPABASE_URL`              | Your Supabase project URL                                | Yes      |
| `TMATES_SUPABASE_ANON_KEY`         | Supabase anonymous key (public key)                      | Yes      |
| `TMATES_API_BASE_URL`              | Tmates Platform API base URL                             | Yes      |
| `TMATES_CLI_DISABLE_SESSION_CACHE` | Set to `1` to disable session token persistence          | No       |
| `DEBUG`                            | Set to `tmates-cli` to enable verbose debug output       | No       |

**Security Note:** The CLI stores session tokens in `~/.tmates-cli-session.json` by default. Set `TMATES_CLI_DISABLE_SESSION_CACHE=1` if you prefer to re-authenticate on every run.

## 7. Usage

### 7.1 Authentication

#### Login with OTP

The CLI uses passwordless authentication via one-time passcodes:

```bash
tmates login
```

You'll be prompted for your email address. A passcode will be sent to your inbox. Enter it when prompted.

**Non-interactive login:**

```bash
tmates login --email you@example.com --otp 123456
```

**Disable session caching for this session:**

```bash
tmates login --no-cache
```

#### Check Authentication Status

View your current session and configuration:

```bash
tmates status
```

Output includes:

- Supabase URL and API endpoint
- Current session status
- Authenticated user email
- Token caching status

#### Logout

Clear your stored session:

```bash
tmates logout
```

### 7.2 Interactive Mode

Launch the full interactive experience:

```bash
tmates
# or
tmates start
```

The interactive mode provides a menu-driven interface for:

- **Chat** – Start conversations with agents, browse threads, send messages
- **Teammates** – Browse agent catalog, hire/dismiss agents
- **Pinboard** – View shared posts and notes
- **Files** – Browse uploaded files
- **Settings** – View profile and preferences

**Navigation:**

- Use numbered menu options to navigate
- Type `back` or `b` to return to the previous screen
- Type `exit` or `quit` to leave the CLI
- Press `Ctrl+C` to force quit

### 7.3 Command Reference

```bash
# Display help
tmates --help

# Show version
tmates --version

# Authenticate
tmates login [options]
  -e, --email <email>     Email address for login
  --otp <code>            One-time passcode
  --no-cache              Disable session persistence

# Sign out
tmates logout

# Check status
tmates status

# Interactive mode (default)
tmates [start]
```

## 8. API Integration

The CLI communicates with the Tmates Platform API via a type-safe HTTP client. All requests include:

- `Authorization: Bearer <token>` header (automatically managed)
- JSON content negotiation
- Error handling with user-friendly messages

**Available API Modules:**

- `messages.ts` – Chat threads, messages, attachments
- `teammates.ts` – Agent store, hire/dismiss operations
- `pinboard.ts` – Pinboard posts and details
- `files.ts` – File listings
- `profile.ts` – User profile data
- `settings.ts` – Mobile app settings

Developers can import these modules to build custom scripts or integrations.

## 9. Development

### 9.1 Local Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test
```

### 9.2 Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

The compiled output will be in the `dist/` directory. The entry point is `dist/index.js`.

### 9.3 Testing

The project uses Vitest for unit testing:

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

Tests are located in `src/cli/__tests__/` and cover:

- Command parsing
- Authentication flows
- API client error handling
- Interactive mode state management

### 9.4 Code Style

The project enforces consistent code style via ESLint and Prettier:

```bash
# Check linting
npm run lint

# Auto-fix issues
npm run lint -- --fix

# Format with Prettier (if configured)
npx prettier --write "src/**/*.ts"
```

### 9.5 Debugging

Enable debug logging to troubleshoot issues:

```bash
DEBUG=tmates-cli tmates
```

Debug logs will be written to stderr and include:

- API request/response details
- Session refresh events
- Configuration resolution steps

## 10. Deployment & Distribution

### 10.1 Publishing to npm

The CLI can be published to npm for public distribution:

```bash
# Update version in package.json
npm version patch  # or minor, major

# Publish to npm
npm publish
```

Users can then install via:

```bash
npm install -g tmates-cli
```

### 10.2 Binary Distribution

For users without Node.js, compile the CLI to a standalone binary using tools like `pkg`:

```bash
npm install -g pkg
pkg . --targets node18-macos-x64,node18-linux-x64,node18-win-x64
```

## 11. Security

- **Passwordless Auth:** OTP-based authentication eliminates password-related vulnerabilities
- **Token Encryption:** Session tokens are stored securely on disk (JSON file with restricted permissions)
- **No Secrets in Code:** All credentials are read from environment variables
- **HTTPS Only:** API communication requires TLS; set `TMATES_API_BASE_URL` to an `https://` endpoint
- **Session Expiry:** Tokens are automatically refreshed; expired sessions require re-authentication
- **Audit:** Run `npm audit` regularly to check for dependency vulnerabilities

**Recommendations:**

- Use `--no-cache` on shared machines to avoid persisting tokens
- Rotate Supabase keys periodically
- Enable 2FA on your Tmates account
- Review `~/.tmates-cli-session.json` permissions (`chmod 600` recommended)

## 12. Troubleshooting

### Common Issues

**`TMATES_SUPABASE_URL is not defined`**

- Ensure `.env` file exists and contains valid Supabase credentials
- Check that environment variables are being loaded (try `DEBUG=tmates-cli tmates status`)

**`Authentication failed` during login**

- Verify your email is registered with Tmates
- Check that the OTP code hasn't expired (valid for 5 minutes)
- Ensure `TMATES_SUPABASE_ANON_KEY` matches your Supabase project

**`Network request failed`**

- Confirm `TMATES_API_BASE_URL` is correct and accessible
- Check firewall/proxy settings
- Verify the Tmates Platform API is running (test with `curl https://api.tmates.app/v1/health`)

**`Session expired` errors**

- The CLI attempts to auto-refresh; if this fails, run `tmates logout && tmates login`
- Check system clock is synchronized (expired tokens can't be refreshed)

**Commands not working after global install**

- Ensure npm global bin directory is in your `$PATH`
- On macOS/Linux: `export PATH="$(npm config get prefix)/bin:$PATH"`
- On Windows: Add `%APPDATA%\npm` to your PATH environment variable

### Getting Help

- Check the [FAQ](https://docs.tmates.app/faq) for common questions
- Report issues at <https://github.com/medhuelabs/tmates-cli/issues>
- Join our community: <https://discord.gg/tmates>
- Email support: <hello@tmates.app>

## 13. Contributing

We welcome contributions! To get started:

1. **Fork the repository** on GitHub
2. **Clone your fork:**

   ```bash
   git clone https://github.com/your-username/tmates-cli.git
   cd tmates-cli
   ```

3. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes:**
   - Write clear, idiomatic TypeScript
   - Add tests for new functionality
   - Update documentation as needed
5. **Test your changes:**

   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

6. **Commit with clear messages:**

   ```bash
   git commit -m "Add feature: describe what you changed"
   ```

7. **Push and open a pull request:**

   ```bash
   git push origin feature/your-feature-name
   ```

**Pull Request Guidelines:**

- Include a clear description of the problem and solution
- Reference related issues (e.g., "Fixes #123")
- Add screenshots for UI changes
- Ensure all tests pass
- Follow the existing code style

## 14. Roadmap

Planned features for future releases:

- 🎯 **Command Shortcuts** – Quick commands for common tasks (`tmates chat adam "Hello"`)
- 📊 **Analytics Dashboard** – View usage stats and teammate activity
- 🔔 **Notifications** – Real-time alerts for agent responses
- 🎨 **Themes** – Customizable color schemes
- 🔌 **Plugin System** – Extend CLI with custom commands
- 📝 **Rich Text** – Markdown rendering in chat threads
- 🌐 **Localization** – Multi-language support
- 💾 **Offline Mode** – Cache data for offline access

Vote on features or suggest new ones at <https://github.com/medhuelabs/tmates-cli/discussions>

## 15. License

Tmates CLI is open source software licensed under the [MIT License](./LICENSE). You are free to use, modify, and distribute the CLI for any purpose.

## 16. Contact & Support

- **Website:** <https://tmates.app>
- **Email:** <hello@tmates.app>
- **Discord:** <https://discord.gg/tmates>
- **Documentation:** <https://docs.tmates.app>
- **GitHub Issues:** <https://github.com/medhuelabs/tmates-cli/issues>
- **Twitter/X:** [@tmatesai](https://twitter.com/tmatesai)

For enterprise support or custom integrations, contact our team at <hello@tmates.app>.

---

**Built with ❤️ by the Tmates team. Happy chatting!** 🤖
