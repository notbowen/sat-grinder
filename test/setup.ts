import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sat-grinder-test-"));
process.env.TEST_DATA_DIR = testDataDir;
process.env.DATA_DIR = testDataDir;
process.env.DATABASE_PATH = path.join(testDataDir, "test.sqlite");
process.env.BETTER_AUTH_SECRET = "test-secret-that-is-deliberately-long-enough";
