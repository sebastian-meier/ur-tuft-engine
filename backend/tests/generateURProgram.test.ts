import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateURProgram, generatePreflightProgram } from '../src/services/urGenerator';

const FIXTURE_PATH = path.resolve(__dirname, '../../tests/test-1.jpg');
const OUTPUT_DIR = path.resolve(__dirname, '../../tests/output');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'test-1.urscript');
const EXPECTED_METADATA = {
  estimatedCycleTimeSeconds: 2523,
  resolution: '720x480',
  imageWidth: 720,
  imageHeight: 480,
  tuftSegments: 376,
  activePixels: 110805,
} as const;

test('generateURProgram emits expected metadata and program for test fixture', async () => {
  const buffer = await fs.readFile(FIXTURE_PATH);
  const result = await generateURProgram(buffer, 'test-1.jpg');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, result.program, 'utf8');

  assert.strictEqual(result.metadata.estimatedCycleTimeSeconds, EXPECTED_METADATA.estimatedCycleTimeSeconds);
  assert.strictEqual(result.metadata.resolution, EXPECTED_METADATA.resolution);
  assert.strictEqual(result.metadata.imageWidth, EXPECTED_METADATA.imageWidth);
  assert.strictEqual(result.metadata.imageHeight, EXPECTED_METADATA.imageHeight);
  assert.strictEqual(result.metadata.tuftSegments, EXPECTED_METADATA.tuftSegments);
  assert.strictEqual(result.metadata.activePixels, EXPECTED_METADATA.activePixels);

  assert.ok(result.program.startsWith('def tuft_program():'), 'Program should start with tuft_program definition');
  assert.ok(
    result.program.includes('contact_force_threshold'),
    'Program should declare a contact force threshold for surface probing',
  );

  const stats = await fs.stat(OUTPUT_PATH);
  assert.ok(stats.size > 0, 'Generated URScript output must not be empty');
});

test('generatePreflightProgram creates a five-waypoint routine with metadata', () => {
  const { program, metadata } = generatePreflightProgram({
    workpieceWidthMm: 500,
    workpieceHeightMm: 500,
  });

  assert.ok(program.includes('tuft_preflight_program'), 'Program should define tuft_preflight_program');
  assert.strictEqual(metadata.waypoints.length, 5, 'Preflight should include four corners and a center waypoint');
  assert.ok(metadata.travelDistanceMm > 0, 'Preflight travel distance should be greater than zero');
  assert.ok(metadata.estimatedCycleTimeSeconds > 0, 'Preflight duration should be greater than zero');
  assert.strictEqual(metadata.cornerDwellSeconds > 0, true, 'Preflight should dwell at each corner');
});
