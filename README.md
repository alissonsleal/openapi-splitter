# OpenAPI Splitter

A command-line tool to split a single OpenAPI 3.0 specification file (JSON or YAML) into multiple files and folders with proper references, making your API specs more maintainable and easier to work with.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- Split a single OpenAPI file into multiple organized files and folders
- Support for both JSON and YAML formats
- Convert between JSON and YAML formats as needed
- Maintain proper references between split files
- Auto-generate index files for components (schemas, parameters, responses)
- Support for path normalization to ensure valid filenames
- Split tags into separate files
- Debug mode for troubleshooting

## 📦 Installation

### Prerequisites

- [Bun](https://bun.sh/) runtime installed

### Global installation

Install the tool globally to use it from anywhere:

```bash
bun install -g openapi-splitter
```

### Local installation

Install as a development dependency in your project:

```bash
bun install --dev openapi-splitter
```

Or clone the repository and install dependencies:

```bash
git clone https://github.com/alissonsleal/openapi-splitter.git
cd openapi-splitter
bun install
```

## 🚀 Usage

```bash
openapi-splitter <file> [options]
```

### Options

- `-o, --output <directory>`: Output directory (default: "./openapi-split")
- `-f, --format <format>`: Output format (json or yaml). If not specified, the input format is used
- `-d, --debug`: Enable debug logging
- `-h, --help`: Display help information
- `-v, --version`: Display version information

## 📋 Examples

### Split a JSON OpenAPI file

```bash
openapi-splitter api.json -o ./split-api
```

### Split a YAML OpenAPI file with specific output format

```bash
openapi-splitter api.yaml -o ./split-api -f json
```

This will convert the YAML input into JSON output files.

### Enable debug logging

```bash
openapi-splitter api.json -o ./split-api --debug
```

## 📁 Directory Structure

The tool will create the following directory structure:

```
output-directory/
├── openapi.json (or .yaml)
├── paths/
│   ├── api_users.json
│   ├── api_users_id_.json
│   └── ...
├── schemas/
│   ├── _index.json
│   ├── User.json
│   ├── Error.json
│   └── ...
├── parameters/
│   ├── _index.json
│   ├── userId.json
│   ├── limitParam.json
│   └── ...
├── responses/
│   ├── _index.json
│   ├── NotFound.json
│   ├── ValidationError.json
│   └── ...
└── tags/
    ├── _index.json
    ├── users.json
    ├── admin.json
    └── ...
```

The main `openapi.json` (or .yaml) file will contain references to all the split files.

## 🔄 How It Works

1. **Parsing**: The tool parses the input OpenAPI file (JSON or YAML) using SwaggerParser
2. **Splitting**: It splits the OpenAPI document into components:
   - Paths: Each API path gets its own file
   - Schemas: Each schema definition goes to a separate file
   - Parameters: Common parameters are extracted
   - Responses: Reusable responses are extracted
   - Tags: API tags are separated
3. **Reference Management**: All references (`$ref`) are updated to point to the correct files
4. **Index Creation**: Index files are created for component collections
5. **Output**: All files are written in the specified format (JSON or YAML)

## 🧠 Use Cases

- **Large API Specifications**: Make large OpenAPI specs more manageable
- **Version Control**: Improve diff readability in version control systems
- **Team Collaboration**: Allow different team members to work on different parts of the API
- **API-First Development**: Create a well-structured foundation for API-first development

## ⚙️ Development

### Build

Build the project:

```bash
bun run build
```

### Run Tests

Run the test suite:

```bash
bun test
```

## 📦 Publishing

This package uses GitHub Actions to automate the release process. When you want to publish a new version:

1. Make sure all changes are committed and pushed to the repository
2. Create a new GitHub Release with a semantic version tag (e.g., `v1.0.1`)
3. The GitHub Actions workflow will automatically:
   - Build the package
   - Run tests
   - Publish to npm

For manual publishing (if needed):

```bash
# Update version according to semantic versioning
npm version patch|minor|major

# Build the package
bun run build

# Test the package locally before publishing
./scripts/test-package.sh

# Publish to npm
npm publish
```

> 📝 Note: To publish to npm, you need to be logged in with `npm login` and have appropriate permissions for the package.

## 👥 Contributing

Contributions are welcome! Please check out our [contribution guidelines](CONTRIBUTING.md) for details on how to submit changes.

Quick start:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`bun install`)
4. Make your changes
5. Run tests to ensure everything works (`bun test`)
6. Commit your changes (`git commit -m 'Add some amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📝 License

MIT
