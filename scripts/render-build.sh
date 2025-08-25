#!/bin/bash

echo "🚀 Starting Render.com Build Process"
echo "===================================="

# Set strict error handling
set -e

# Function to handle cache corruption
handle_cache_corruption() {
    echo "⚠️  Cache corruption detected, clearing cache..."
    
    # Clear yarn cache
    yarn cache clean --force 2>/dev/null || echo "Yarn cache clean failed"
    
    # Clear npm cache if exists
    npm cache clean --force 2>/dev/null || echo "NPM cache clean failed"
    
    # Remove node_modules if exists
    if [ -d "node_modules" ]; then
        echo "📦 Removing existing node_modules..."
        rm -rf node_modules
    fi
    
    # Remove yarn.lock to force fresh resolution
    if [ -f "yarn.lock" ]; then
        echo "🔒 Backing up and removing yarn.lock for fresh install..."
        cp yarn.lock yarn.lock.backup
        rm yarn.lock
    fi
}

# Function to install dependencies with retry
install_dependencies() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "📦 Installing dependencies (attempt $attempt/$max_attempts)..."
        
        if yarn install --network-timeout 600000 --frozen-lockfile 2>/dev/null; then
            echo "✅ Dependencies installed successfully"
            return 0
        else
            echo "❌ Installation failed on attempt $attempt"
            
            if [ $attempt -eq $max_attempts ]; then
                echo "🆘 Trying with cache corruption handling..."
                handle_cache_corruption
                
                echo "🔄 Final attempt with fresh cache..."
                yarn install --network-timeout 600000 || {
                    echo "💥 All installation attempts failed"
                    exit 1
                }
            else
                echo "🔄 Retrying in 5 seconds..."
                sleep 5
            fi
        fi
        
        ((attempt++))
    done
}

# Main execution
echo "🔍 Checking environment..."
echo "Node version: $(node --version)"
echo "Yarn version: $(yarn --version)"
echo "Current directory: $(pwd)"

# Check for cache corruption signs
if ! yarn install --dry-run 2>/dev/null; then
    echo "⚠️  Potential cache issues detected"
    handle_cache_corruption
fi

# Install dependencies
install_dependencies

# Verify installation
echo "🔍 Verifying installation..."
if [ -d "node_modules" ] && [ -f "package.json" ]; then
    echo "✅ Build completed successfully"
    echo "📦 Node modules size: $(du -sh node_modules 2>/dev/null || echo 'Unknown')"
else
    echo "❌ Build verification failed"
    exit 1
fi

echo "🎉 Build process completed successfully!"