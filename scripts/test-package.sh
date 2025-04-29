#!/bin/bash

# This script builds the package and installs it locally to test before publishing

# Ensure the script exits on first error
set -e

echo "Building the package..."
bun run build

echo "Creating a temporary directory for testing..."
TEST_DIR=$(mktemp -d)

# Copy the built package and necessary files to the test directory
echo "Copying built package to test directory..."
cp -r dist package.json README.md LICENSE* $TEST_DIR 2>/dev/null || :

# Navigate to the test directory
cd $TEST_DIR

# Remove any build script to avoid rebuilding in the temp dir
sed -i '/\"build\":/d' package.json
sed -i '/\"prepare\":/d' package.json
sed -i '/\"prepublishOnly\":/d' package.json

# Create a package and get its filename
echo "Creating npm package..."
PACKAGE_FILENAME=$(npm pack | tail -n 1)

if [ -z "$PACKAGE_FILENAME" ]; then
  echo "Failed to create package"
  exit 1
fi

echo "Created package: $PACKAGE_FILENAME"

# Create a test project to install the package
echo "Creating test project..."
TEST_PROJECT="$TEST_DIR/test-project"
mkdir -p $TEST_PROJECT
cd $TEST_PROJECT

# Initialize a new project
npm init -y

# Install the locally created package
echo "Installing local package..."
npm install --no-save "../$PACKAGE_FILENAME"

# Create a test file
echo "Creating test script..."
cat > test.js << EOF
#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('Testing openapi-splitter CLI...');
  const output = execSync('npx openapi-splitter --version', { encoding: 'utf-8' });
  console.log('Output:', output);
  console.log('CLI test successful!');
} catch (error) {
  console.error('CLI test failed:', error);
  process.exit(1);
}
EOF

# Make the test file executable
chmod +x test.js

# Run the test
echo "Running test..."
node test.js

# Clean up
echo "Cleaning up..."
cd ../../
rm -rf "$TEST_DIR"

echo "Test completed successfully!"