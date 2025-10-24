"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const urGenerator_1 = require("../src/services/urGenerator");
const FIXTURE_PATH = node_path_1.default.resolve(__dirname, '../../tests/test-1.jpg');
const OUTPUT_DIR = node_path_1.default.resolve(__dirname, '../../tests/output');
const OUTPUT_PATH = node_path_1.default.join(OUTPUT_DIR, 'test-1.urscript');
const EXPECTED_METADATA = {
    estimatedCycleTimeSeconds: 4734,
    resolution: '720x480',
    imageWidth: 720,
    imageHeight: 480,
    tuftSegments: 376,
    activePixels: 110805,
};
(0, node_test_1.default)('generateURProgram emits expected metadata and program for test fixture', async () => {
    const buffer = await node_fs_1.promises.readFile(FIXTURE_PATH);
    const result = await (0, urGenerator_1.generateURProgram)(buffer, 'test-1.jpg');
    await node_fs_1.promises.mkdir(OUTPUT_DIR, { recursive: true });
    await node_fs_1.promises.writeFile(OUTPUT_PATH, result.program, 'utf8');
    strict_1.default.strictEqual(result.metadata.estimatedCycleTimeSeconds, EXPECTED_METADATA.estimatedCycleTimeSeconds);
    strict_1.default.strictEqual(result.metadata.resolution, EXPECTED_METADATA.resolution);
    strict_1.default.strictEqual(result.metadata.imageWidth, EXPECTED_METADATA.imageWidth);
    strict_1.default.strictEqual(result.metadata.imageHeight, EXPECTED_METADATA.imageHeight);
    strict_1.default.strictEqual(result.metadata.tuftSegments, EXPECTED_METADATA.tuftSegments);
    strict_1.default.strictEqual(result.metadata.activePixels, EXPECTED_METADATA.activePixels);
    strict_1.default.ok(result.metadata.boundingBoxMm, 'Bounding box metadata should be present when dark pixels exist');
    if (result.metadata.boundingBoxMm) {
        const { minX, maxX, minY, maxY } = result.metadata.boundingBoxMm;
        for (const value of [minX, maxX, minY, maxY]) {
            strict_1.default.ok(Number.isFinite(value), 'Bounding box coordinates should be finite numbers');
        }
        strict_1.default.ok(minX < maxX, 'Bounding box minX should be smaller than maxX');
        strict_1.default.ok(minY < maxY, 'Bounding box minY should be smaller than maxY');
    }
    strict_1.default.ok(result.metadata.movementCount > 0, 'Movement count should be tracked for progress reporting');
    strict_1.default.ok(result.program.startsWith('def tuft_program():'), 'Program should start with tuft_program definition');
    const stats = await node_fs_1.promises.stat(OUTPUT_PATH);
    strict_1.default.ok(stats.size > 0, 'Generated URScript output must not be empty');
});
(0, node_test_1.default)('generatePreflightProgram creates a five-waypoint routine with metadata', () => {
    const { program, metadata } = (0, urGenerator_1.generatePreflightProgram)({
        workpieceWidthMm: 500,
        workpieceHeightMm: 500,
    });
    strict_1.default.ok(program.includes('tuft_preflight_program'), 'Program should define tuft_preflight_program');
    strict_1.default.strictEqual(metadata.waypoints.length, 5, 'Preflight should include four corners and a center waypoint');
    strict_1.default.ok(metadata.travelDistanceMm > 0, 'Preflight travel distance should be greater than zero');
    strict_1.default.ok(metadata.estimatedCycleTimeSeconds > 0, 'Preflight duration should be greater than zero');
    strict_1.default.strictEqual(metadata.cornerDwellSeconds > 0, true, 'Preflight should dwell at each corner');
});
(0, node_test_1.default)('generateToolTestProgram jogs along Z and toggles the tool output', () => {
    const { program, metadata } = (0, urGenerator_1.generateToolTestProgram)({
        toolOutput: 3,
        travelSpeedMmPerSec: 150,
        workpieceWidthMm: 500,
        workpieceHeightMm: 400,
        workpieceBufferMm: 50,
    });
    strict_1.default.ok(program.includes('tuft_tool_test_program'), 'Program should define tuft_tool_test_program');
    strict_1.default.ok(program.includes('local test_pose_temp = pose_trans(tuft_coords'), 'Program should compute a buffered pose_trans for relative movement');
    strict_1.default.ok(program.includes('sleep(5.0)'), 'Program should dwell for five seconds');
    strict_1.default.strictEqual(metadata.toolOutput, 3);
    strict_1.default.strictEqual(metadata.displacementMeters, 0.15);
    strict_1.default.strictEqual(metadata.dwellSeconds, 5);
    strict_1.default.strictEqual(metadata.travelSpeedMmPerSec, 150);
});
(0, node_test_1.default)('generateBoundingBoxRoutine emits moves for each supplied corner', () => {
    const boundingBox = {
        minX: 10,
        maxX: 30,
        minY: 5,
        maxY: 25,
    };
    const { program, metadata } = (0, urGenerator_1.generateBoundingBoxRoutine)(boundingBox, {
        safeHeightMm: 120,
        travelSpeedMmPerSec: 180,
    });
    strict_1.default.ok(program.includes('tuft_bounding_box_program'), 'Program should define tuft_bounding_box_program');
    strict_1.default.ok(program.includes('p[0.0100'), 'Program should reference minimum X corner');
    strict_1.default.deepEqual(metadata.boundingBox, boundingBox, 'Metadata should echo the provided bounding box');
    strict_1.default.ok(metadata.travelDistanceMm > 0, 'Routine should include travel distance');
});
//# sourceMappingURL=generateURProgram.test.js.map
