# DataKit

**Modern web-based data analysis tool**

Process CSV/JSON/XLSX/PARQUET files locally with complete privacy. No data ever leaves your machine.

##  Quick Start

```bash
# Install DataKit
pip install datakit-local

# Start DataKit (opens browser automatically)
datakit

# Or start server without opening browser
datakit serve --no-open
```

## Features

-  **Complete Privacy**: All data processing happens locally
-  **Large Files**: Process CSV/JSON files up to 4-5GB
-  **Fast Analysis**: DuckDB-powered SQL engine via WebAssembly
-  **Modern Interface**: React-based web UI
-  **Visualizations**: Built-in charts and data exploration
-  **Advanced Queries**: Full SQL support with auto-completion

## Installation

### Requirements
- Python 3.8 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Install from PyPI
```bash
pip install datakit-local
```

## Usage

### Basic Commands

```bash
# Start DataKit (default behavior)
datakit

# Start server only
datakit serve

# Start and open browser explicitly  
datakit open

# Start on custom port
datakit serve --port 8080

# Start on custom host (network accessible)
datakit serve --host 0.0.0.0 --port 3000

# Start without opening browser
datakit serve --no-open
```

### Information Commands

```bash
# Show version and features
datakit version

# Show system information
datakit info

# Check for updates
datakit update
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port` | Specify port number | Auto-detect (3000-3100) |
| `-h, --host` | Specify host address | 127.0.0.1 |
| `--no-open` | Don't open browser automatically | Opens browser |
| `--reload` | Enable auto-reload (development) | Disabled |

## 🔧 Advanced Usage

### Custom Configuration

```python
from datakit import create_app, find_free_port
import uvicorn

# Create custom app
app = create_app()

# Find available port
port = find_free_port()

# Run with custom settings
uvicorn.run(app, host="0.0.0.0", port=port)
```

### Programmatic Usage

```python
import datakit

# Start server programmatically
datakit.run_server(host="localhost", port=3000)
```

## Use Cases

Perfect for:
- **Data Scientists**: Analyze datasets without cloud dependencies
- **Privacy-Conscious Users**: Process sensitive data locally
- **Enterprise Environments**: No data leaves your network
- **Large File Analysis**: Handle multi-GB files efficiently
- **SQL Analysis**: Query your data with full SQL support

## Security & Privacy

- **Local Processing**: All computation happens in your browser
- **No Data Upload**: Files never leave your machine
- **No Internet Required**: Works offline after installation
- **Enterprise-Safe**: Perfect for sensitive data analysis

## Supported File Formats

- **CSV**: Comma-separated values with auto-detection
- **JSON**: Nested JSON files with flattening support
- **Large Files**: Optimized for files up to 4-5GB

## Comparison with Other Tools

| Feature | DataKit | Pandas | Excel | Cloud Tools |
|---------|---------|--------|-------|-------------|
| File Size Limit | Couple of GBs | Memory Limited | 1M rows | Varies |
| Privacy | Complete | Complete | Complete | Limited |
| SQL Support | Full | Limited | None | Varies |
| Setup Time | 1 command | Code required | Manual | Account setup |
| Browser Interface | ✅ | ❌ | ❌ | ✅ |
| Offline Use | ✅ | ✅ | ✅ | ❌ |

## Related Packages

- **Node.js**: `npm install -g datakit-cli`
- **Docker**: `docker run -p 8080:80 datakit/app`
- **Homebrew**: `brew install datakit` (coming soon)

## Examples

### Analyze Sales Data
```bash
# Start DataKit
datakit

# Upload your sales.csv file
# Write SQL queries like:
# SELECT product, SUM(revenue) FROM sales GROUP BY product
# Create visualizations with built-in charts
```

### Process Large Datasets
```bash
# DataKit handles large files efficiently
datakit serve

# Load multi-GB files with streaming processing
# Query with pagination for smooth performance
```

## License

AGPL-3.0-only License - see [LICENSE](LICENSE) file for details.

## Support

- 📚 **Documentation**: https://docs.datakit.page
- 💬 **Discussions**: https://discord.gg/gZmXmhbBdP
- 🌐 **Website**: https://datakit.page

## Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Click](https://click.palletsprojects.com/) - Command line interface
- [DuckDB](https://duckdb.org/) - High-performance analytical database
- [React](https://reactjs.org/) - User interface library

---

**DataKit** - Bringing powerful data analysis to your local environment with complete privacy and security.