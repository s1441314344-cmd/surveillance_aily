#!/bin/bash

# Build for macOS (Current Host)
echo "Building for macOS..."
pyinstaller --name=surveillance-aily-macos --onefile --add-data "yolov5s.pt:." main.py

# Check if Docker is available for Linux build
if command -v docker &> /dev/null; then
    echo "Building for Linux (via Docker)..."
    docker build -t surveillance-aily-builder -f build_scripts/Dockerfile.linux .
    docker run --rm -v $(pwd)/dist:/app/dist surveillance-aily-builder
else
    echo "Docker not found. Skipping Linux build."
fi

echo "Build complete. Artifacts are in dist/"
