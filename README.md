<p align="center">
  <h1 align="center">🧹 Windows Cleaner CLI</h1>
  <p align="center">
    <strong>Free & Open Source Windows cleanup tool</strong>
  </p>
  <p align="center">
    Scan and remove junk files, caches, logs, and more — all from your terminal.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/windows-cleaner-cli"><img src="https://img.shields.io/npm/v/windows-cleaner-cli?color=cb3837&label=npm&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/windows-cleaner-cli"><img src="https://img.shields.io/npm/dm/windows-cleaner-cli?color=cb3837&logo=npm" alt="npm downloads"></a>
  <a href="https://github.com/guhcostan/windows-cleaner-cli/actions/workflows/ci.yml"><img src="https://github.com/guhcostan/windows-cleaner-cli/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/windows-cleaner-cli" alt="Node.js Version"></a>
  <a href="https://www.microsoft.com/windows"><img src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows" alt="Platform: Windows"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://socket.dev/npm/package/windows-cleaner-cli"><img src="https://socket.dev/api/badge/npm/package/windows-cleaner-cli" alt="Socket Badge"></a>
</p>

<p align="center">
  <a href="https://github.com/guhcostan/windows-cleaner-cli"><img src="https://img.shields.io/github/stars/guhcostan/windows-cleaner-cli?style=social" alt="GitHub Stars"></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/guhcostan"><img src="https://img.shields.io/badge/Ko--fi-Support_this_project-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support on Ko-fi"></a>
</p>

<p align="center">
  <strong>🍎 Also available for macOS:</strong> <a href="https://github.com/guhcostan/mac-cleaner-cli">mac-cleaner-cli</a>
</p>

---

## ⚡ Quick Start

```bash
npx windows-cleaner-cli
```

That's it! No installation needed. The CLI will:

1. 🔍 **Scan** your PC for cleanable files
2. 📋 **Show** you what was found with sizes
3. ✅ **Let you select** exactly what to clean
4. 🗑️ **Clean** the selected items safely

## 🎬 See It In Action

```
$ npx windows-cleaner-cli

🧹 Windows Cleaner CLI
──────────────────────────────────────────────────────

Scanning your PC for cleanable files...

Found 32.5 GB that can be cleaned:

? Select categories to clean (space to toggle, enter to confirm):
  ◉ 🟢 Recycle Bin                        2.1 GB (45 items)
  ◉ 🟢 Browser Cache                      1.5 GB (4 items)
  ◉ 🟢 Temporary Files                  549.2 MB (622 items)
  ◉ 🟡 User Cache Files                  12.5 GB (118 items)
  ◉ 🟡 Development Cache                 15.9 GB (14 items)

Summary:
  Items to delete: 803
  Space to free: 32.5 GB

? Proceed with cleaning? (Y/n)

✨ Cleaning Complete!
───────────────────────────────────────────────────────────

   Space freed:        32.5 GB
   Items cleaned:      803
   Duration:           23s
   Success rate:       100.0%

   Disk space:         45.8 GB → 78.3 GB available

───────────────────────────────────────────────────────────

Breakdown by category:
  Recycle Bin                        2.1 GB
  Browser Cache                      1.5 GB
  Temporary Files                  549.2 MB
  User Cache Files                  12.5 GB
  Development Cache                 15.9 GB
```

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **One Command** | Just run `npx windows-cleaner-cli` — no complex flags |
| 🎯 **Interactive** | Select exactly what you want to clean with checkboxes |
| 🛡️ **Safe by Default** | Risky items hidden unless you use `--risky` |
| 🔍 **Smart Scanning** | Finds caches, logs, dev files, browser data, and more |
| 📋 **Cleaning Profiles** | Use built-in profiles (quick, developer, full) or create custom ones |
| 📊 **JSON Output** | Automation-friendly output with `--json` flag |
| 📄 **Export Reports** | Generate HTML or Markdown reports with `--report` |
| 📱 **App Remover** | Remove apps and their associated files |
| 🔧 **Maintenance** | Flush DNS cache, run Disk Cleanup, clear caches |
| 🔒 **Privacy First** | 100% offline — no data ever leaves your machine |
| 📦 **Minimal Dependencies** | Only 5 runtime deps, all from trusted maintainers |

## 🎯 What It Cleans

### 🟢 Safe (always safe to delete)

| Category | What it cleans |
|----------|---------------|
| `recycle-bin` | Files in the Recycle Bin |
| `temp-files` | Temporary files in TEMP and Windows\Temp |
| `browser-cache` | Chrome, Edge, Firefox, Brave cache |
| `chocolatey` | Chocolatey/Scoop package manager cache |
| `docker` | Unused Docker images, containers, volumes |

### 🟡 Moderate (generally safe)

| Category | What it cleans |
|----------|---------------|
| `system-cache` | Application caches in AppData\Local |
| `system-logs` | System and application logs |
| `dev-cache` | npm, yarn, pip, NuGet, Gradle cache |
| `node-modules` | Orphaned node_modules in old projects |
| `windows-update` | Old Windows Update files |
| `prefetch` | Windows Prefetch data |

### 🔴 Risky (use `--risky` flag)

| Category | What it cleans |
|----------|---------------|
| `downloads` | Downloads older than 30 days |
| `itunes-backups` | iPhone and iPad backup files from iTunes |
| `duplicates` | Duplicate files (keeps newest) |
| `large-files` | Files larger than 500MB |

## 📖 Usage

### Basic Usage

```bash
# Interactive mode — scan, select, and clean
npx windows-cleaner-cli

# Include risky categories
npx windows-cleaner-cli --risky
```

### Remove Apps

Remove applications with their preferences, caches, and support files:

```bash
npx windows-cleaner-cli uninstall
```

### Maintenance Tasks

```bash
# Flush DNS cache
npx windows-cleaner-cli maintenance --dns

# Run Windows Disk Cleanup
npx windows-cleaner-cli maintenance --disk

# Clear thumbnail cache
npx windows-cleaner-cli maintenance --thumbnails

# Clear font cache (requires admin)
npx windows-cleaner-cli maintenance --fonts
```

### Cleaning Profiles

Use built-in profiles for quick cleanup or create your own:

```bash
# Use a built-in profile
npx windows-cleaner-cli clean --profile quick      # Browser cache, temp, recycle bin
npx windows-cleaner-cli clean --profile developer  # Dev caches, node_modules, Docker
npx windows-cleaner-cli clean --profile full       # All safe and moderate categories

# Manage profiles
npx windows-cleaner-cli profile --list             # List all profiles
npx windows-cleaner-cli profile --show developer   # Show profile details
npx windows-cleaner-cli profile --create           # Create a custom profile
npx windows-cleaner-cli profile --delete myprofile # Delete a custom profile
```

### Automation & Scripting

Use JSON output for scripting and automation:

```bash
# Get scan results as JSON
npx windows-cleaner-cli scan --json

# Clean with JSON output (non-interactive)
npx windows-cleaner-cli clean --profile quick --yes --json

# Pipe to jq for processing
npx windows-cleaner-cli scan --json | jq '.summary.totalSize'
```

### Export Reports

Generate detailed reports in HTML or Markdown:

```bash
# Generate HTML report after scanning
npx windows-cleaner-cli scan --report scan-report.html

# Generate Markdown report after cleaning
npx windows-cleaner-cli clean --all --yes --report cleanup-2024.md

# Combine with profiles for automated reports
npx windows-cleaner-cli clean --profile full --yes --report monthly-cleanup.html
```

### Other Commands

```bash
# List all available categories
npx windows-cleaner-cli categories

# Manage configuration
npx windows-cleaner-cli config --init
npx windows-cleaner-cli config --show

# Manage backups
npx windows-cleaner-cli backup --list
npx windows-cleaner-cli backup --clean
```

## 💻 Global Installation

If you use this tool frequently:

```bash
npm install -g windows-cleaner-cli
windows-cleaner-cli
```

## 🔒 Security

| | |
|---|---|
| ✅ **Open Source** | All code publicly available for audit |
| ✅ **No Network** | Operates 100% offline |
| ✅ **Minimal Deps** | Only 5 runtime dependencies |
| ✅ **CI/CD** | Every release tested with TypeScript, ESLint, and automated tests |
| ✅ **Socket.dev** | Dependencies monitored for supply chain attacks |

Found a vulnerability? Report it via [GitHub Security Advisories](https://github.com/guhcostan/windows-cleaner-cli/security/advisories/new).

## 🛠️ Development

```bash
git clone https://github.com/guhcostan/windows-cleaner-cli.git
cd windows-cleaner-cli
npm install
npm run dev      # Run in dev mode
npm test         # Run tests
npm run lint     # Run linter
npm run build    # Build for production
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 💚 Support

If this tool saved you time or disk space, consider supporting the project!

<p align="center">
  <a href="https://ko-fi.com/guhcostan"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi"></a>
</p>

Your support helps maintain and improve this tool. Thank you! 🙏

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>⚠️ Disclaimer</strong><br>
  This tool deletes files from your system. While we've implemented safety measures, always ensure you have backups of important data.
</p>

<p align="center">
  Made with ❤️ for Windows users everywhere
</p>
