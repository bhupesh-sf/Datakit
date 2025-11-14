# DataKit - Your All-in-One Data Analysis Platform

![DataKit](assets/dk%20banner.png)

## What is DataKit?

DataKit is a powerful browser-based data analysis platform that processes multi-gigabyte files locally on your machine with complete privacy. No data ever leaves your browser, yet you get the full power of professional data analysis tools.

## Key Features & Capabilities

### 📊 **Data Import & Processing**
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

### 🔍 **Data Preview & Inspection**
- **Interactive Grid View**: Browse your data with sortable columns and resizable cells
- **Smart Data Detection**: Automatic detection of data types and formats
- **Data Quality Analysis**: Get instant insights about:
  - Missing values and null patterns
  - Data type distributions
  - Column statistics (mean, median, mode, etc.)
  - Outlier detection
  - Data quality scores
- **Quick Overview Panel**: See key metrics and patterns at a glance
- **Export Options**: Export filtered data or specific columns in various formats

### 💾 **SQL Query Engine**
- **DuckDB Integration**: Full-featured SQL database running entirely in your browser
- **Query Editor**: Professional SQL editor with:
  - Syntax highlighting and auto-completion
  - Query history and favorites
  - Smart query optimization suggestions
  - Real-time error detection
- **Schema Browser**: Explore your data structure with ease
- **Query Templates**: Pre-built queries for common operations
- **Performance Optimization**: Automatic query optimization for large datasets
- **Results Management**: 
  - Paginated results for smooth browsing
  - Export query results to CSV
  - Full-screen mode for focused work

### 🤖 **AI Assistant**
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
- **Query Explanation**: Get plain-English explanations of complex SQL

### 📓 **Python Notebooks**
- **Interactive Notebooks**: Write and execute Python code in cells
- **DuckDB Bridge**: Direct access to your loaded data via SQL
- **Data Science Libraries**: Pre-loaded with pandas, numpy, matplotlib, and more
- **Hugging Face Transformers**: Built-in support for ML models
- **Variable Inspector**: Track your Python variables and their values
- **Package Manager**: Install additional Python packages on demand
- **Export Options**: Save as Jupyter notebooks or PDF reports
- **Templates**: Start with pre-built templates for common analyses

### 🔄 **Workflow Features**
- **Workspace Management**: Organize projects with multiple files and queries
- **Auto-save**: Never lose your work with automatic saving
- **Keyboard Shortcuts**: Speed up your workflow with comprehensive shortcuts
- **Split Views**: Compare datasets or work on multiple tasks
- **Recent Files**: Quick access to recently used files
- **Undo/Redo**: Full undo/redo support for all operations

## Use Cases

### For Data Analysts
- Import sales data from CSV files
- Write SQL queries to analyze trends
- Export results for presentations

### For Data Scientists
- Load large datasets without server uploads
- Use Python notebooks for statistical analysis
- Apply machine learning models via Hugging Face
- Create reproducible research workflows

### For Business Users
- Connect to Google Sheets for live data
- Use AI assistant to ask questions in plain English
- Generate charts without coding knowledge
- Export professional-looking reports

### For Developers
- Query PostgreSQL databases directly
- Test SQL queries with sample data
- Analyze API response JSONs
- Debug data transformation pipelines

## Privacy & Security

🔒 **Complete Privacy**: All data processing happens in your browser. No data is ever sent to external servers unless you explicitly connect to cloud services.

🚀 **No Installation Required**: Works instantly in any modern browser - Chrome, Firefox, Safari, or Edge.

⚡ **WebAssembly Performance**: Native-speed processing using cutting-edge WebAssembly technology.

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

## Tips for Best Experience

- For files over 100MB, use Chrome or Edge for best performance
- Enable hardware acceleration in your browser settings
- Close unnecessary tabs when working with very large datasets
- Use the query limit feature when exploring new datasets

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

- **Documentation**: [DataKit Docs](https://docs.datakit.studio)
- **Issues**: [GitHub Issues](https://github.com/datakitpage/datakit/issues)
- **Community**: [Discord](https://discord.gg/your-server)
- **Contact**: [LinkedIn](https://www.linkedin.com/company/datakitpage)