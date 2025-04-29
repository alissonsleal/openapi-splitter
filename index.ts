#!/usr/bin/env node
import SwaggerParser from '@apidevtools/swagger-parser'
import { program } from 'commander'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the package version safely
let version = '1.0.0' // Default version
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const packageJson = fs.readJSONSync(path.join(__dirname, 'package.json'))
  version = packageJson.version
} catch (error) {
  // Use default version if package.json can't be read
}

interface SplitterOptions {
  output: string
  format?: 'json' | 'yaml'
  debug?: boolean
}

interface SplitterContext {
  openApiDoc: any
  outputDir: string
  format: 'json' | 'yaml'
  extension: string
  debug: boolean
}

// Debug logger function
const log = (context: SplitterContext, message: string): void => {
  if (context.debug) {
    console.log(`[DEBUG] ${message}`)
  }
}

// Function to update references to point to their new file locations
const updateReferences = (obj: any, context: SplitterContext): any => {
  // Don't process null or non-object values
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  // For arrays, map each item recursively
  if (Array.isArray(obj)) {
    return obj.map((item) => updateReferences(item, context))
  }

  // Process object properties
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      // Handle different reference types
      if (value.startsWith('#/components/schemas/')) {
        // Schema reference - update to point to schemas directory
        const schemaName = value.replace('#/components/schemas/', '')
        result[key] = `../schemas/${schemaName}${context.extension}`
      } else if (value.startsWith('#/components/parameters/')) {
        // Parameter reference - update to point to parameters directory
        const paramName = value.replace('#/components/parameters/', '')
        result[key] = `../parameters/${paramName}${context.extension}`
      } else if (value.startsWith('#/components/responses/')) {
        // Response reference - update to point to responses directory
        const respName = value.replace('#/components/responses/', '')
        result[key] = `../responses/${respName}${context.extension}`
      } else {
        // Other references - leave as is for now
        result[key] = value
      }
      log(context, `Updated reference: ${value} -> ${result[key]}`)
    } else {
      // Recursively process nested objects
      result[key] = updateReferences(value, context)
    }
  }
  return result
}

// Parse the OpenAPI file
const parseFile = async (file: string): Promise<any> => {
  try {
    // Ensure we're using an absolute path
    const absolutePath = path.isAbsolute(file)
      ? file
      : path.resolve(process.cwd(), file)

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`)
    }

    console.log(`Parsing file: ${absolutePath}`)

    // Use SwaggerParser to validate and parse the file
    const api = await SwaggerParser.parse(absolutePath)
    return api
  } catch (error) {
    console.error(`Failed to parse OpenAPI file: ${error}`)
    throw error
  }
}

// Write content to a file in the specified format
const writeFile = (
  filePath: string,
  content: any,
  format: 'json' | 'yaml',
  context: SplitterContext
): void => {
  try {
    // Update references in the content
    const updatedContent = updateReferences(content, context)

    // Convert the content to JSON or YAML
    let fileContent: string
    if (format === 'json') {
      fileContent = JSON.stringify(updatedContent, null, 2)
    } else {
      fileContent = yaml.dump(updatedContent, { noRefs: true })
    }

    // Ensure the directory exists
    const dirPath = path.dirname(filePath)
    fs.mkdirSync(dirPath, { recursive: true })

    // Write the file synchronously
    fs.writeFileSync(filePath, fileContent, 'utf8')
    log(context, `File written: ${filePath}`)
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error)
    throw new Error(`Failed to write file ${filePath}: ${error}`)
  }
}

// Normalize path for file name
const normalizePathForFileName = (pathUrl: string): string => {
  // Replace all special characters with underscores
  // This is more aggressive to ensure valid filenames
  return pathUrl
    .replace(/^\//, '') // Remove leading slash
    .replace(/[^a-zA-Z0-9]/g, '_') // Replace all non-alphanumeric chars with underscores
    .replace(/_{2,}/g, '_') // Replace multiple consecutive underscores with a single one
}

// Split schemas into separate files
const splitSchemas = (context: SplitterContext): void => {
  const { openApiDoc, outputDir, format, extension } = context
  const schemas = openApiDoc.components?.schemas
  if (!schemas) {
    log(context, 'No schemas found in OpenAPI document')
    return
  }

  const indexContent: Record<string, any> = {}

  log(context, `Found ${Object.keys(schemas).length} schemas to split`)

  // Create separate files for each schema
  for (const [schemaName, schema] of Object.entries(schemas)) {
    const schemaPath = path.join(
      outputDir,
      'schemas',
      `${schemaName}${extension}`
    )
    writeFile(schemaPath, schema, format, context)
    indexContent[schemaName] = { $ref: `./${schemaName}${extension}` }
  }

  // Create index file for schemas
  writeFile(
    path.join(outputDir, 'schemas', `_index${extension}`),
    indexContent,
    format,
    context
  )
}

// Split paths into separate files
const splitPaths = (context: SplitterContext): void => {
  const { openApiDoc, outputDir, format, extension } = context
  const paths = openApiDoc.paths
  if (!paths) {
    log(context, 'No paths found in OpenAPI document')
    return
  }

  log(context, `Found ${Object.keys(paths).length} paths to split`)

  // Create separate files for each path
  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    const fileName = normalizePathForFileName(pathUrl)
    log(
      context,
      `Processing path: "${pathUrl}" -> filename: "${fileName}${extension}"`
    )

    const pathFilePath = path.join(
      outputDir,
      'paths',
      `${fileName}${extension}`
    )

    log(context, `Writing path file: ${pathFilePath}`)
    try {
      writeFile(pathFilePath, pathItem, format, context)
    } catch (error) {
      console.error(`Failed to write path file ${pathFilePath}:`, error)
      throw error
    }
  }
}

// Split parameters into separate files
const splitParameters = (context: SplitterContext): void => {
  const { openApiDoc, outputDir, format, extension } = context
  const parameters = openApiDoc.components?.parameters
  if (!parameters) {
    log(context, 'No parameters found in OpenAPI document')
    return
  }

  log(context, `Found ${Object.keys(parameters).length} parameters to split`)

  const indexContent: Record<string, any> = {}

  // Create separate files for each parameter
  for (const [paramName, param] of Object.entries(parameters)) {
    const paramPath = path.join(
      outputDir,
      'parameters',
      `${paramName}${extension}`
    )
    writeFile(paramPath, param, format, context)
    indexContent[paramName] = { $ref: `./${paramName}${extension}` }
  }

  // Create index file for parameters
  writeFile(
    path.join(outputDir, 'parameters', `_index${extension}`),
    indexContent,
    format,
    context
  )
}

// Split responses into separate files
const splitResponses = (context: SplitterContext): void => {
  const { openApiDoc, outputDir, format, extension } = context
  const responses = openApiDoc.components?.responses
  if (!responses) {
    log(context, 'No responses found in OpenAPI document')
    return
  }

  log(context, `Found ${Object.keys(responses).length} responses to split`)

  const indexContent: Record<string, any> = {}

  // Create separate files for each response
  for (const [responseName, response] of Object.entries(responses)) {
    const responsePath = path.join(
      outputDir,
      'responses',
      `${responseName}${extension}`
    )
    writeFile(responsePath, response, format, context)
    indexContent[responseName] = { $ref: `./${responseName}${extension}` }
  }

  // Create index file for responses
  writeFile(
    path.join(outputDir, 'responses', `_index${extension}`),
    indexContent,
    format,
    context
  )
}

// Split tags into separate files
const splitTags = (context: SplitterContext): void => {
  const { openApiDoc, outputDir, format, extension } = context
  const tags = openApiDoc.tags
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    log(context, 'No tags found in OpenAPI document')
    return
  }

  log(context, `Found ${tags.length} tags to split`)

  // Create a tags directory if it doesn't exist
  const tagsDir = path.join(outputDir, 'tags')
  fs.mkdirSync(tagsDir, { recursive: true })

  // Create an index file for all tags
  const indexContent: Record<string, any> = {}

  // Process each tag
  for (const tag of tags) {
    if (!tag.name) continue

    const tagName = tag.name.replace(/[^a-zA-Z0-9]/g, '_')
    const tagPath = path.join(tagsDir, `${tagName}${extension}`)

    writeFile(tagPath, tag, format, context)
    indexContent[tagName] = { $ref: `./${tagName}${extension}` }
  }

  // Create index file for tags
  writeFile(
    path.join(outputDir, 'tags', `_index${extension}`),
    indexContent,
    format,
    context
  )
}

// Create the main OpenAPI file with references to all components
const createMainFile = (context: SplitterContext): void => {
  const { openApiDoc, outputDir, extension, format } = context

  // Create the main OpenAPI file with references to separate files
  const mainDoc: any = {
    openapi: openApiDoc.openapi,
    info: openApiDoc.info,
    servers: openApiDoc.servers,
    paths: {},
    components: {
      schemas: {},
      parameters: {},
      responses: {},
    },
  }

  // Add security schemes if they exist
  if (openApiDoc.components?.securitySchemes) {
    mainDoc.components.securitySchemes = openApiDoc.components.securitySchemes
  }

  // Add paths references
  for (const pathUrl of Object.keys(openApiDoc.paths || {})) {
    const fileName = normalizePathForFileName(pathUrl)
    log(context, `Adding path reference for ${pathUrl} -> ${fileName}`)
    mainDoc.paths[pathUrl] = { $ref: `./paths/${fileName}${extension}` }
  }

  // Add components references
  if (openApiDoc.components?.schemas) {
    mainDoc.components.schemas = { $ref: `./schemas/_index${extension}` }
  }

  if (openApiDoc.components?.parameters) {
    mainDoc.components.parameters = { $ref: `./parameters/_index${extension}` }
  }

  if (openApiDoc.components?.responses) {
    mainDoc.components.responses = { $ref: `./responses/_index${extension}` }
  }

  // Add tags if they exist
  if (
    openApiDoc.tags &&
    Array.isArray(openApiDoc.tags) &&
    openApiDoc.tags.length > 0
  ) {
    mainDoc.tags = { $ref: `./tags/_index${extension}` }
  }

  // Write the main OpenAPI file
  writeFile(
    path.join(outputDir, `openapi${extension}`),
    mainDoc,
    format,
    context
  )
}

// Main function to split the OpenAPI specification
export const splitOpenApi = async (
  inputFile: string,
  options: SplitterOptions
): Promise<void> => {
  const debug = options.debug || false

  try {
    // Resolve the absolute path for the output directory
    const outputDir = path.isAbsolute(options.output)
      ? options.output
      : path.resolve(process.cwd(), options.output)

    console.log(`Reading OpenAPI specification from ${inputFile}...`)

    // Determine format from extension if not specified
    const format =
      options.format ||
      (path.extname(inputFile).toLowerCase() === '.json' ? 'json' : 'yaml')
    const extension = format === 'json' ? '.json' : '.yaml'

    // Create the context object that will be passed to all functions
    const context: SplitterContext = {
      openApiDoc: null, // Will be set after parsing
      outputDir,
      format,
      extension,
      debug,
    }

    if (debug) {
      console.log(`[DEBUG] Input file: ${inputFile}`)
      console.log(`[DEBUG] Output directory: ${outputDir}`)
      console.log(`[DEBUG] Format: ${format}`)
      console.log(`[DEBUG] Extension: ${extension}`)
    }

    // Parse the OpenAPI document
    const openApiDoc = await parseFile(inputFile)
    context.openApiDoc = openApiDoc

    if (!openApiDoc) {
      throw new Error(
        'Failed to parse OpenAPI document: Document is empty or invalid'
      )
    }

    console.log(`Creating output directory structure in: ${outputDir}...`)

    // Remove the directory if it exists to start fresh
    if (fs.existsSync(outputDir)) {
      fs.removeSync(outputDir)
    }

    // Create output directory and subdirectories synchronously
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`Created output directory: ${outputDir}`)

    const dirs = ['schemas', 'paths', 'parameters', 'responses']
    for (const dir of dirs) {
      const dirPath = path.join(outputDir, dir)
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`Created directory: ${dirPath}`)
    }

    // Split the document
    console.log('Splitting OpenAPI specification...')

    // Run operations
    splitSchemas(context)
    splitPaths(context)
    splitParameters(context)
    splitResponses(context)
    splitTags(context)

    // Create the main file after all components have been split
    createMainFile(context)

    console.log(`\nOpenAPI specification successfully split into ${outputDir}`)
  } catch (error) {
    console.error('Error splitting OpenAPI specification:', error)
    throw error // Re-throw for tests
  }
}

// Set up the command line interface
program
  .name('openapi-splitter')
  .description('Split an OpenAPI specification into multiple files')
  .version(version)
  .argument('<file>', 'The OpenAPI specification file to split')
  .option('-o, --output <directory>', 'Output directory', './openapi-split')
  .option(
    '-f, --format <format>',
    'Output format (json or yaml). If not specified, the input format is used'
  )
  .option('-d, --debug', 'Enable debug logging', false)
  .action(async (file, options) => {
    try {
      await splitOpenApi(file, {
        output: options.output,
        format: options.format as 'json' | 'yaml' | undefined,
        debug: options.debug,
      })
    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    }
  })

// Only parse arguments when this file is run directly, not when imported
// Make it compatible with both Bun and Node.js
const isBun = typeof globalThis.Bun !== 'undefined'
if (
  (isBun && import.meta.url === globalThis.Bun.main) ||
  (!isBun && process.argv[1] === fileURLToPath(import.meta.url))
) {
  program.parse()
}
