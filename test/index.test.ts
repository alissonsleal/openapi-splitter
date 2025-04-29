import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Import the main function to test
import { splitOpenApi } from '../index'

// Test output directory
const TEST_OUTPUT_DIR = path.join(__dirname, 'output')

// Paths to the test fixtures
const JSON_FIXTURE = path.join(__dirname, 'fixtures', 'petstore.json')
const YAML_FIXTURE = path.join(__dirname, 'fixtures', 'petstore.yaml')
const TAGGED_JSON_FIXTURE = path.join(
  __dirname,
  'fixtures',
  'petstore-with-tags.json'
)

// Create a modified version of the petstore fixture with tags
const setupTaggedFixture = async () => {
  // Read the existing fixture
  const petstoreSpec = await fs.readJson(JSON_FIXTURE)

  // Add a tags array
  petstoreSpec.tags = [
    {
      name: 'pets',
      description: 'Everything about your Pets',
    },
    {
      name: 'store',
      description: 'Access to Petstore orders',
    },
  ]

  // Write the modified fixture
  await fs.writeJson(TAGGED_JSON_FIXTURE, petstoreSpec, { spaces: 2 })

  return petstoreSpec
}

describe('OpenAPI Splitter', () => {
  // Clean up the test output directory before each test
  beforeEach(async () => {
    await fs.emptyDir(TEST_OUTPUT_DIR)

    // Setup the tagged fixture
    await setupTaggedFixture()
  })

  // Clean up after all tests
  afterEach(async () => {
    await fs.remove(TEST_OUTPUT_DIR)

    // Clean up the tagged fixture
    if (await fs.pathExists(TAGGED_JSON_FIXTURE)) {
      await fs.remove(TAGGED_JSON_FIXTURE)
    }
  })

  test('should split a JSON OpenAPI specification', async () => {
    // Split the JSON OpenAPI file
    await splitOpenApi(JSON_FIXTURE, { output: TEST_OUTPUT_DIR })

    // Verify the output directory structure
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'openapi.json'))
    ).toBe(true)
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas'))).toBe(
      true
    )
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'paths'))).toBe(true)
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'parameters'))).toBe(
      true
    )
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'responses'))).toBe(
      true
    )

    // Verify the schema files
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', '_index.json'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', 'Pet.json'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', 'Pets.json'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', 'Error.json'))
    ).toBe(true)

    // Verify the paths files - use the new normalized path names
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'paths', 'pets.json'))
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.join(TEST_OUTPUT_DIR, 'paths', 'pets_petId_.json')
      )
    ).toBe(true)

    // Verify the parameters files
    expect(
      await fs.pathExists(
        path.join(TEST_OUTPUT_DIR, 'parameters', '_index.json')
      )
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.join(TEST_OUTPUT_DIR, 'parameters', 'limitParam.json')
      )
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.join(TEST_OUTPUT_DIR, 'parameters', 'petId.json')
      )
    ).toBe(true)

    // Verify the responses files
    expect(
      await fs.pathExists(
        path.join(TEST_OUTPUT_DIR, 'responses', '_index.json')
      )
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'responses', 'Error.json'))
    ).toBe(true)

    // Verify the main OpenAPI file contains the expected references
    const mainFile = await fs.readJson(
      path.join(TEST_OUTPUT_DIR, 'openapi.json')
    )
    expect(mainFile.info.title).toBe('Swagger Petstore')
    expect(mainFile.paths['/pets'].$ref).toContain('paths/pets.json')
    expect(mainFile.components.schemas.$ref).toContain('schemas/_index.json')
  })

  test('should split a YAML OpenAPI specification', async () => {
    // Split the YAML OpenAPI file
    await splitOpenApi(YAML_FIXTURE, { output: TEST_OUTPUT_DIR })

    // Verify the output directory structure
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'openapi.yaml'))
    ).toBe(true)
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas'))).toBe(
      true
    )
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'paths'))).toBe(true)
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'parameters'))).toBe(
      true
    )
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'responses'))).toBe(
      true
    )

    // Verify the schema files
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', '_index.yaml'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', 'Pet.yaml'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', 'Pets.yaml'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', 'Error.yaml'))
    ).toBe(true)

    // Verify the paths files - use the new normalized path names
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'paths', 'pets.yaml'))
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.join(TEST_OUTPUT_DIR, 'paths', 'pets_petId_.yaml')
      )
    ).toBe(true)

    // Read and verify the content of one of the split files using js-yaml
    const yaml = await import('js-yaml')
    const fileContent = await fs.readFile(
      path.join(TEST_OUTPUT_DIR, 'schemas', 'Pet.yaml'),
      'utf8'
    )
    const petSchema = yaml.load(fileContent)
    expect(petSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: expect.arrayContaining(['id', 'name']),
      })
    )
  })

  test('should convert JSON to YAML when format option is specified', async () => {
    // Split the JSON OpenAPI file with YAML output format
    await splitOpenApi(JSON_FIXTURE, {
      output: TEST_OUTPUT_DIR,
      format: 'yaml',
    })

    // Verify the output files are in YAML format
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'openapi.yaml'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', '_index.yaml'))
    ).toBe(true)
  })

  test('should convert YAML to JSON when format option is specified', async () => {
    // Split the YAML OpenAPI file with JSON output format
    await splitOpenApi(YAML_FIXTURE, {
      output: TEST_OUTPUT_DIR,
      format: 'json',
    })

    // Verify the output files are in JSON format
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'openapi.json'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'schemas', '_index.json'))
    ).toBe(true)

    // Verify the content of the JSON file
    const mainFile = await fs.readJson(
      path.join(TEST_OUTPUT_DIR, 'openapi.json')
    )
    expect(mainFile.info.title).toBe('Swagger Petstore')
  })

  test('should split tags in a JSON OpenAPI specification', async () => {
    // Split the tagged JSON OpenAPI file
    await splitOpenApi(TAGGED_JSON_FIXTURE, { output: TEST_OUTPUT_DIR })

    // Verify the tags directory is created
    expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags'))).toBe(true)

    // Verify the tags index file
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags', '_index.json'))
    ).toBe(true)

    // Verify individual tag files
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags', 'pets.json'))
    ).toBe(true)
    expect(
      await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags', 'store.json'))
    ).toBe(true)

    // Verify the main OpenAPI file references the tags
    const mainFile = await fs.readJson(
      path.join(TEST_OUTPUT_DIR, 'openapi.json')
    )
    expect(mainFile.tags.$ref).toContain('tags/_index.json')

    // Verify the content of a tag file
    const tagFile = await fs.readJson(
      path.join(TEST_OUTPUT_DIR, 'tags', 'pets.json')
    )
    expect(tagFile.name).toBe('pets')
    expect(tagFile.description).toBe('Everything about your Pets')
  })

  test('should split tags in a YAML OpenAPI specification with YAML output', async () => {
    // Create a YAML version of the tagged fixture
    const petstoreSpec = await fs.readJson(TAGGED_JSON_FIXTURE)
    const yaml = await import('js-yaml')
    const yamlContent = yaml.dump(petstoreSpec)
    const taggedYamlFixture = path.join(
      __dirname,
      'fixtures',
      'petstore-with-tags.yaml'
    )
    await fs.writeFile(taggedYamlFixture, yamlContent, 'utf8')

    try {
      // Split the YAML OpenAPI file
      await splitOpenApi(taggedYamlFixture, {
        output: TEST_OUTPUT_DIR,
        format: 'yaml',
      })

      // Verify the tags directory is created
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags'))).toBe(true)

      // Verify the tags index file
      expect(
        await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags', '_index.yaml'))
      ).toBe(true)

      // Verify individual tag files
      expect(
        await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags', 'pets.yaml'))
      ).toBe(true)
      expect(
        await fs.pathExists(path.join(TEST_OUTPUT_DIR, 'tags', 'store.yaml'))
      ).toBe(true)

      // Read and verify the content of the tag file
      const fileContent = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, 'tags', 'pets.yaml'),
        'utf8'
      )
      // Add type assertion to fix TypeScript error
      const tagData = yaml.load(fileContent) as {
        name: string
        description: string
      }
      expect(tagData.name).toBe('pets')
      expect(tagData.description).toBe('Everything about your Pets')
    } finally {
      // Clean up the YAML fixture
      if (await fs.pathExists(taggedYamlFixture)) {
        await fs.remove(taggedYamlFixture)
      }
    }
  })
})
