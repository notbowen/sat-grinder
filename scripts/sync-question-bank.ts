import "dotenv/config";
import { createSyncRun, runQuestionBankSync } from "../src/lib/question-bank/sync";

async function main() { const runId = await createSyncRun(null); console.log(`Starting authorized question-bank sync ${runId}...`); await runQuestionBankSync(runId); console.log("Question-bank sync completed."); }
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
