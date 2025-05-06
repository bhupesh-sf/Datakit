# wasm-src/data-processing/build.sh
#!/bin/bash

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack is not installed. Installing..."
    cargo install wasm-pack
fi

# Build WebAssembly module
wasm-pack build --target web --out-dir ../../public/wasm/data-processing