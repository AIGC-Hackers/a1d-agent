#!/bin/bash

# Add build timestamp to .env.production
echo "Setting build timestamp..."
dotenvx set BUILD_TIMESTAMP "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" -f .env.production

# Run the original build command
# Use npx to ensure mastra is found in node_modules
pnpm mastra build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful, patching output file..."

    # Replace the createNodeServer call to enable playground
    if [ -f ".mastra/output/index.mjs" ]; then
        # Detect OS and use appropriate sed syntax
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' 's/await createNodeServer(mastra)/await createNodeServer(mastra, {playground: true})/g' .mastra/output/index.mjs
        else
            # Linux and others
            sed -i 's/await createNodeServer(mastra)/await createNodeServer(mastra, {playground: true})/g' .mastra/output/index.mjs
        fi
        echo "Patched .mastra/output/index.mjs to enable playground"
    else
        echo "Warning: .mastra/output/index.mjs not found"
    fi

    # Handle playground files based on OS
    if [ -d "node_modules/mastra/src/playground/dist" ]; then
        # Remove existing link or directory if it exists
        if [ -e ".mastra/playground" ]; then
            rm -rf .mastra/playground
        fi

        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS (development) - create symbolic link
            ln -s ../node_modules/mastra/src/playground/dist .mastra/playground
            echo "Created symbolic link: .mastra/playground -> node_modules/mastra/src/playground/dist"
        else
            # Linux (Docker) - copy files
            cp -r node_modules/mastra/src/playground/dist .mastra/playground
            echo "Copied playground files to .mastra/playground"
        fi
    else
        echo "Warning: node_modules/mastra/src/playground/dist not found"
    fi
else
    echo "Build failed"
    exit 1
fi