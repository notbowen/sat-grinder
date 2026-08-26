import { runQuestionBankSync } from "../src/lib/question-bank/sync";

async function main() {
  console.log("Starting authorized College Board question-bank synchronization...");
  const result = await runQuestionBankSync(process.env.GITHUB_ACTIONS ? "github-action" : "manual-cli");
  console.log(`Imported ${result.imported} questions; excluded ${result.activeExcluded} active-test questions from practice.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
