# DataKit CLI

Run DataKit locally on your machine with complete data privacy and security.

## Installation

```bash
npm install -g datakit-cli
```

## Usage

### Quick Start
```bash
# Start DataKit (opens browser automatically)
datakit

# Or explicitly use the open command
datakit open
```

### Server Commands
```bash
# Start server without opening browser
datakit serve --no-open

# Specify custom port
datakit serve --port 8080

# Specify custom host
datakit serve --host 0.0.0.0 --port 3000
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Specify port number | Auto-detect (3000-3100) |
| `-h, --host <host>` | Specify host | localhost |
| `--no-open` | Don't open browser automatically | Opens browser |

## Examples

```bash
# Basic usage - starts on available port and opens browser
datakit

# Start on specific port
datakit --port 8080

# Start server accessible from network
datakit serve --host 0.0.0.0 --port 3000

# Start without opening browser
datakit serve --no-open
```

## Features

- 🔒 **Complete Privacy**: All data processing happens in the local browser
- 🚀 **Fast Setup**: One command to get started
- 🌐 **Web Interface**: Modern React-based UI
- 📊 **Powerful Analysis**: DuckDB-powered SQL engine
- 📁 **Large Files**: Process CSV/JSON/EXCEL/PARQUET files up to couple of GBs
- 🔍 **Advanced Queries**: Full SQL support with visualization

## Data Security

- No data ever leaves your machine
- No internet connection required after installation
- Process sensitive data with confidence
- Perfect for enterprise environments

## Requirements

- Node.js 18.0.0 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Troubleshooting

### Port Already in Use
If you get a "port in use" error, DataKit will automatically find the next available port. You can also specify a custom port:

```bash
datakit --port 8080
```

### Browser Doesn't Open
If the browser doesn't open automatically, manually navigate to the URL shown in the terminal.

### Permission Issues
If you encounter permission issues during installation:

```bash
# Use sudo on macOS/Linux
sudo npm install -g datakit-cli

# Or use npx to run without installing
npx datakit-cli
```

## Support

- 📚 Documentation: https://docs.datakit.page
- 💬 Discussions on Discord: https://discord.gg/gZmXmhbBdP

## License

AGPL-3.0-only License - see LICENSE file for details.