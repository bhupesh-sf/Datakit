"""
DataKit - Modern web-based data analysis tool

A powerful, client-side data analysis tool that processes CSV and JSON files
locally using DuckDB and WebAssembly. No data ever leaves your machine.

Features:
- Process large files (couple of GBs) locally
- SQL-powered analysis with DuckDB
- Data inspection tools
- Modern React-based web interface
- Complete data privacy
- Visualization capabilities
"""

__version__ = "0.4.20"
__author__ = "DataKit Team"
__email__ = "amin@datakit.page"
__license__ = "AGPL-3.0-only"

from .server import create_app, find_free_port
from .cli import main

__all__ = ["create_app", "find_free_port", "main"]