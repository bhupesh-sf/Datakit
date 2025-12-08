# DataKit - Private Data Analysis Studio

![DataKit](assets/dk_banner.png)

<div align="center">

[![Website](https://img.shields.io/badge/Website-datakit.studio-blue)](https://datakit.studio)
[![Documentation](https://img.shields.io/badge/Docs-Read-green)](https://docs.datakit.studio)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/datakitpage/datakit)
[![Discord](https://img.shields.io/badge/Discord-Join-7289da)](https://discord.com/invite/gZmXmhbBdP)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5)](https://www.linkedin.com/company/datakitpage)
[![License](https://img.shields.io/badge/License-Dual%20AGPL--3.0%2FCommercial-blue)](LICENSING)

</div>

## What is DataKit?

DataKit is a browser-based data analysis platform that processes multi-gigabyte files locally. All processing happens in your browser - no data is sent to external servers.

## Key Features

### Data Import & Processing
- **Local File Support**: Import CSV, Excel (XLSX), JSON, and Parquet files directly in your browser
- **Large File Handling**: Process files up to several GBs efficiently using WebAssembly technology
- **Remote Data Sources**: Connect to various cloud platforms:
  - Amazon S3 buckets
  - Google Sheets (public)
  - HuggingFace datasets
  - MotherDuck (cloud DuckDB)
  - PostgreSQL databases
  - Custom URLs
- **Split View**: Compare two datasets side-by-side
- **Multi-file Management**: Work with multiple datasets simultaneously with tabbed interface

### Data Preview & Inspection
- **Interactive Grid View**: Browse your data with sortable columns and resizable cells
- **Smart Data Detection**: Automatic detection of data types and formats
- **Data Quality Analysis**: Instant insights about:
  - Missing values and null patterns
  - Data type distributions
  - Column statistics (mean, median, mode, etc.)
  - Outlier detection
  - Data quality scores
- **Quick Overview Panel**: Key metrics and patterns
- **Export Options**: Export filtered data or specific columns in various formats

### SQL Query Engine
- **DuckDB Integration**: Full-featured SQL database running entirely in your browser
- **Query Editor**: Professional SQL editor with:
  - Syntax highlighting and auto-completion
  - Query history and favorites
  - Smart query optimization suggestions
  - Real-time error detection
- **Schema Browser**: Explore your data structure
- **Query Templates**: Pre-built queries for common operations
- **Performance Optimization**: Automatic query optimization for large datasets
- **Results Management**: 
  - Paginated results for smooth browsing
  - Export query results to CSV
  - Full-screen mode for focused work

### AI Assistant
- **Natural Language Queries**: Ask questions in plain English
- **SQL Generation**: Automatically generate SQL from your questions
- **Data Insights**: Get AI-powered insights and recommendations
- **Multiple AI Providers**:
  - DataKit Cloud AI (default)
  - OpenAI GPT models
  - Anthropic Claude
  - Groq
  - Local models via Ollama
- **Context-Aware**: Understands your data structure and suggests relevant queries
- **Query Explanation**: Plain-English explanations of complex SQL

### Python Notebooks
- **Interactive Notebooks**: Write and execute Python code in cells
- **DuckDB Bridge**: Direct access to your loaded data via SQL
- **Data Science Libraries**: Pre-loaded with pandas, numpy, matplotlib, and more
- **Hugging Face Transformers**: Built-in support for ML models
- **Variable Inspector**: Track your Python variables and their values
- **Package Manager**: Install additional Python packages on demand
- **Export Options**: Save as Jupyter notebooks or PDF reports
- **Templates**: Start with pre-built templates for common analyses

## Privacy & Security

**Complete Privacy**: All data processing happens in your browser. No data is sent to external servers unless you explicitly connect to cloud services.

**No Installation Required**: Works in any modern browser - Chrome, Firefox, Safari, or Edge.

## Getting Started

1. **Open DataKit** in your browser
2. **Import your data** - drag & drop or click to browse
3. **Choose your workflow**:
   - Preview data in the grid view
   - Write SQL queries in the Query tab
   - Ask questions using the AI Assistant
   - Write Python code in Notebooks

## Supported File Formats

- **CSV** - Comma-separated values
- **Excel** - .xlsx and .xls files
- **JSON** - Including nested structures
- **Parquet** - Columnar storage format
- **Remote Sources** - S3, Google Sheets, PostgreSQL, and more

## System Requirements

- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- At least 4GB RAM (8GB+ recommended for large files)
- Desktop or laptop computer (mobile support coming soon)

## 📋 License

DataKit is available under a **dual licensing model**:

### Open Source (AGPL-3.0)
- Free for open source projects
- Must disclose source code
- For learning and non-commercial use

### Commercial License
- No source code disclosure required
- Enterprise self-hosting allowed
- Priority support included
- Custom features available

**Need a commercial license?** Enterprise and commercial users must obtain a commercial license.

**Get your license**: [Contact Us](amin@datakit.page)  

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

- **Documentation**: [DataKit Docs](https://docs.datakit.studio)
- **Issues**: [GitHub Issues](https://github.com/datakitpage/datakit/issues)
- **Community**: [Discord](https://discord.gg/your-server)
- **Contact**: [Amin Khorrami](mailto:amin@datakit.page) | [LinkedIn](https://www.linkedin.com/company/datakitpage)