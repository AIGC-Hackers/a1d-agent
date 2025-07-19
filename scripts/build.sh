#!/bin/bash

# Run the original build command
mastra build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful, patching output file..."
    
    # Replace the createNodeServer call to enable playground
    if [ -f ".mastra/output/index.mjs" ]; then
        sed -i 's/await createNodeServer(mastra)/await createNodeServer(mastra, {playground: true})/g' .mastra/output/index.mjs
        echo "Patched .mastra/output/index.mjs to enable playground"
    else
        echo "Warning: .mastra/output/index.mjs not found"
    fi
else
    echo "Build failed"
    exit 1
fi