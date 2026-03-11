#!/usr/bin/env python3
"""
DataKit CLI - Command line interface for DataKit data analysis tool
"""

import click
import webbrowser
import sys
import platform
import subprocess
from importlib.metadata import version as get_version
from typing import Optional
import asyncio
import uvicorn
from .server import create_app, find_free_port


def get_system_info():
    """Get system information for diagnostics"""
    return {
        "platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "python_version": platform.python_version(),
        "datakit_version": get_version("datakit-local"),
    }


@click.group(invoke_without_command=True)
@click.pass_context
@click.version_option()
def main(ctx):
    """DataKit - Modern web-based data analysis tool
    
    Process CSV and JSON files locally with complete privacy.
    Powered by DuckDB and WebAssembly.
    """
    if ctx.invoked_subcommand is None:
        # Default behavior: start server and open browser
        ctx.invoke(serve, open_browser=True)


@main.command()
@click.option("--port", "-p", type=int, help="Port number (auto-detected if not specified)")
@click.option("--host", "-h", default="127.0.0.1", help="Host address")
@click.option("--no-open", is_flag=True, help="Don't open browser automatically")
@click.option("--reload", is_flag=True, help="Enable auto-reload for development")
def serve(port: Optional[int], host: str, no_open: bool, reload: bool):
    """Start DataKit server"""
    if port is None:
        port = find_free_port()
    
    click.echo("🚀 Starting DataKit...")
    
    app = create_app()
    
    # Print server info
    url = f"http://{host}:{port}"
    click.echo()
    click.secho("✅ DataKit is running!", fg="green")
    click.echo()
    click.secho(f"  Local:   {url}", fg="cyan")
    if host == "127.0.0.1":
        click.secho(f"  Network: http://0.0.0.0:{port}", fg="cyan")
    click.echo()
    click.secho("  Press Ctrl+C to stop the server", fg="bright_black")
    click.echo()
    
    # Open browser
    if not no_open:
        click.secho("🌐 Opening browser...", fg="blue")
        try:
            webbrowser.open(url)
        except Exception:
            click.secho("⚠️  Could not open browser automatically", fg="yellow")
            click.secho("  Please navigate to the URL above manually", fg="bright_black")
    
    # Start server
    try:
        uvicorn.run(
            app,
            host=host,
            port=port,
            reload=reload,
            access_log=False,
            log_level="error" if not reload else "info"
        )
    except KeyboardInterrupt:
        click.echo()
        click.secho("🛑 Shutting down DataKit...", fg="yellow")
        click.secho("✅ DataKit stopped successfully", fg="green")


@main.command()
@click.option("--port", "-p", type=int, help="Port number")
@click.option("--host", "-h", default="127.0.0.1", help="Host address")
def open(port: Optional[int], host: str):
    """Start DataKit server and open in browser"""
    if port is None:
        port = find_free_port()
    
    from click.testing import CliRunner
    runner = CliRunner()
    runner.invoke(serve, ["--port", str(port), "--host", host])


@main.command()
def version():
    """Show DataKit version information"""
    version = get_version("datakit-local")
    
    click.echo()
    click.secho("📦 DataKit", fg="blue")
    click.secho(f"Version: {version}", fg="green")
    click.secho("Homepage: https://datakit.page", fg="cyan")
    click.echo()
    click.secho("💡 Features:", fg="yellow")
    click.secho("  • Process CSV/JSON files up to 4-5GB", fg="bright_black")
    click.secho("  • DuckDB-powered SQL engine", fg="bright_black")
    click.secho("  • Complete data privacy (local processing)", fg="bright_black")
    click.secho("  • Modern React-based interface", fg="bright_black")
    click.echo()


@main.command()
def info():
    """Show system and DataKit information"""
    system_info = get_system_info()
    
    click.echo()
    click.secho("🔍 DataKit System Information", fg="blue")
    click.echo()
    click.secho("DataKit Information:", fg="yellow")
    click.secho(f"  Version: {system_info['datakit_version']}", fg="white")
    click.echo()
    click.secho("System Information:", fg="yellow")
    click.secho(f"  Platform: {system_info['platform']}", fg="white")
    click.secho(f"  Python: {system_info['python_version']}", fg="white")
    click.echo()
    click.secho("💡 Recommended for optimal performance:", fg="yellow")
    click.secho("  • Python 3.8+ for better performance", fg="bright_black")
    click.secho("  • 8GB+ RAM for large file processing", fg="bright_black")
    click.secho("  • Modern browser (Chrome/Firefox/Safari/Edge)", fg="bright_black")
    click.echo()


@main.command()
def update():
    """Check for updates"""
    click.secho("🔍 Checking for updates...", fg="blue")
    
    try:
        # Check PyPI for latest version
        result = subprocess.run([
            sys.executable, "-m", "pip", "index", "versions", "datakit-local"
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            # Parse output to get latest version
            current_version = get_version("datakit-local")
            
            click.echo()
            click.secho(f"Current version: {current_version}", fg="yellow")
            click.echo()
            click.secho("To update, run:", fg="blue")
            click.secho("  pip install --upgrade datakit-local", fg="cyan")
            click.echo()
        else:
            click.secho("⚠️  Could not check for updates", fg="yellow")
            click.secho("Please check your internet connection", fg="bright_black")
            
    except subprocess.TimeoutExpired:
        click.secho("⚠️  Update check timed out", fg="yellow")
    except Exception as e:
        click.secho(f"❌ Failed to check for updates: {e}", fg="red")
    
    click.echo()


if __name__ == "__main__":
    main()