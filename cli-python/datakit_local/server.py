"""
FastAPI server for serving DataKit static files
"""

import os
import socket
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sys
if sys.version_info >= (3, 9):
    from importlib.resources import files as importlib_files
else:
    from importlib_resources import files as importlib_files


def find_free_port(start_port: int = 3000, end_port: int = 3100) -> int:
    """Find a free port in the given range"""
    for port in range(start_port, end_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    
    # If no port found in range, let the system choose
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]


def get_static_path() -> Path:
    """Get the path to static files bundled with the package"""
    try:
        # Try to get from installed package
        package_path = str(importlib_files('datakit_local').joinpath('static'))
        return Path(package_path)
    except Exception:
        # Fallback for development
        current_dir = Path(__file__).parent
        static_path = current_dir / "static"
        if static_path.exists():
            return static_path
        
        # Last resort - look for dist folder
        dist_path = current_dir / "dist"
        if dist_path.exists():
            return dist_path
            
        raise FileNotFoundError("Could not find static files")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""
    app = FastAPI(
        title="DataKit",
        description="Modern web-based data analysis tool",
        version="0.1.0",
        docs_url=None,  # Disable automatic docs
        redoc_url=None,  # Disable automatic redoc
    )
    
    static_path = get_static_path()
    
    # Mount static files
    app.mount("/static", StaticFiles(directory=static_path), name="static")
    
    @app.get("/")
    async def read_root():
        """Serve the main index.html file"""
        index_file = static_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        else:
            return {"error": "DataKit static files not found"}
    
    @app.get("/{full_path:path}")
    async def catch_all(request: Request, full_path: str):
        """Handle client-side routing by serving index.html for all routes"""
        # Check if it's a request for a static file
        file_path = static_path / full_path
        
        # If file exists, serve it
        if file_path.is_file():
            return FileResponse(file_path)
        
        # For everything else (SPA routes), serve index.html
        index_file = static_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        else:
            return {"error": "DataKit static files not found"}
    
    return app


def run_server(
    host: str = "127.0.0.1",
    port: Optional[int] = None,
    reload: bool = False
):
    """Run the DataKit server"""
    import uvicorn
    
    if port is None:
        port = find_free_port()
    
    app = create_app()
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=reload,
        access_log=False,
        log_level="error" if not reload else "info"
    )


if __name__ == "__main__":
    run_server()