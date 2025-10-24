import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  generateURProgram,
  generatePreflightProgram,
  generateToolTestProgram,
  generateBoundingBoxRoutine,
  BoundingBoxMm,
} from '../src/services/urGenerator';

const FIXTURE_PATH = path.resolve(__dirname, '../../tests/test-1.jpg');
const OUTPUT_DIR = path.resolve(__dirname, '../../tests/output');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'test-1.urscript');
const EXPECTED_METADATA = {
  estimatedCycleTimeSeconds: 4734,
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
  assert.ok(result.metadata.boundingBoxMm, 'Bounding box metadata should be present when dark pixels exist');
  if (result.metadata.boundingBoxMm) {
    const { minX, maxX, minY, maxY } = result.metadata.boundingBoxMm;
    for (const value of [minX, maxX, minY, maxY]) {
      assert.ok(Number.isFinite(value), 'Bounding box coordinates should be finite numbers');
    }
    assert.ok(minX < maxX, 'Bounding box minX should be smaller than maxX');
    assert.ok(minY < maxY, 'Bounding box minY should be smaller than maxY');
  }
  assert.ok(result.metadata.movementCount > 0, 'Movement count should be tracked for progress reporting');

  assert.ok(result.program.startsWith('def tuft_program():'), 'Program should start with tuft_program definition');

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

test('generateToolTestProgram jogs along Z and toggles the tool output', () => {
  const { program, metadata } = generateToolTestProgram({
    toolOutput: 3,
    travelSpeedMmPerSec: 150,
    workpieceWidthMm: 500,
    workpieceHeightMm: 400,
    workpieceBufferMm: 50,
  });

  assert.ok(program.includes('tuft_tool_test_program'), 'Program should define tuft_tool_test_program');
  assert.ok(
    program.includes('local test_pose_temp = pose_trans(tuft_coords'),
    'Program should compute a buffered pose_trans for relative movement',
  );
  assert.ok(program.includes('sleep(5.0)'), 'Program should dwell for five seconds');
  assert.strictEqual(metadata.toolOutput, 3);
  assert.strictEqual(metadata.displacementMeters, 0.15);
  assert.strictEqual(metadata.dwellSeconds, 5);
  assert.strictEqual(metadata.travelSpeedMmPerSec, 150);
});

test('generateBoundingBoxRoutine emits moves for each supplied corner', () => {
  const boundingBox: BoundingBoxMm = {
    minX: 10,
    maxX: 30,
    minY: 5,
    maxY: 25,
  };

  const { program, metadata } = generateBoundingBoxRoutine(boundingBox, {
    safeHeightMm: 120,
    travelSpeedMmPerSec: 180,
  });

  assert.ok(program.includes('tuft_bounding_box_program'), 'Program should define tuft_bounding_box_program');
  assert.ok(program.includes('p[0.0100'), 'Program should reference minimum X corner');
  assert.deepEqual(metadata.boundingBox, boundingBox, 'Metadata should echo the provided bounding box');
  assert.ok(metadata.travelDistanceMm > 0, 'Routine should include travel distance');
});
