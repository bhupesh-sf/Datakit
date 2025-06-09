from setuptools import setup, find_packages
import os

# Read README file
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

# Read version from package
def get_version():
    version_file = os.path.join(os.path.dirname(__file__), 'datakit_local', '__init__.py')
    with open(version_file, 'r') as f:
        for line in f:
            if line.startswith('__version__'):
                return line.split('=')[1].strip().strip('"').strip("'")
    return "0.1.0"

setup(
    name="datakit-local",
    version=get_version(),
    author="DataKit Team",
    author_email="amin@wavequery.com",
    description="Modern web-based data analysis tool - process CSV/JSON/EXCEL/PARQUET files locally with SQL",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://datakit.page",
    project_urls={
        "Homepage": "https://datakit.page",
        "Documentation": "https://docs.datakit.page",
        "Bug Reports":"https://docs.datakit.page",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "Topic :: Database",
        "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
        "Topic :: Software Development :: User Interfaces",
    ],
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0.0",
        "uvicorn>=0.18.0",
        "fastapi>=0.68.0",
        "aiofiles>=0.8.0",
    ],
    extras_require={
        "dev": [
            "pytest>=6.0",
            "pytest-asyncio",
            "black",
            "isort",
            "flake8",
        ],
    },
    entry_points={
        "console_scripts": [
            "datakit=datakit_local.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "datakit_local": ["static/**/*"],
    },
    keywords=[
        "data-analysis", 
        "csv", 
        "json", 
        "sql", 
        "duckdb", 
        "local", 
        "privacy",
        "analytics",
        "visualization"
    ],
    zip_safe=False,
)