import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync("data.sqlite", { readOnly: true });
database.exec("pragma query_only = on");

const command = process.argv[2];

function iso(value) {
  return value == null ? null : new Date(Number(value)).toISOString();
}

function literal(value) {
  if (value == null) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function timestamp(value) {
  const converted = iso(value);
  return converted == null ? "null" : `${literal(converted)}::timestamptz`;
}

function boolean(value) {
  return Number(value) ? "true" : "false";
}

function validateSnapshot() {
  const integrity = database.prepare("pragma integrity_check").all();
  const foreignKeys = database.prepare("pragma foreign_key_check").all();
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") throw new Error("SQLite integrity_check failed.");
  if (foreignKeys.length) throw new Error("SQLite foreign_key_check failed.");
}

function emitSyncRuns() {
  const rows = database.prepare("select * from sync_runs order by started_at").all();
  const values = rows.map((row) => `(
    ${literal(row.id)}::uuid, ${literal(row.status)}, 'legacy-admin', ${timestamp(row.started_at)},
    ${timestamp(row.completed_at)}, ${Number(row.total_metadata)}, ${Number(row.fetched_details)},
    ${Number(row.imported)}, ${Number(row.active_excluded)}, ${literal(row.error)}
  )`).join(",\n");
  process.stdout.write(`insert into public.sync_runs (
    id, status, trigger_source, started_at, completed_at, total_metadata,
    fetched_details, imported, active_excluded, error
  ) values ${values}
  on conflict (id) do update set
    status = excluded.status, trigger_source = excluded.trigger_source,
    started_at = excluded.started_at, completed_at = excluded.completed_at,
    total_metadata = excluded.total_metadata, fetched_details = excluded.fetched_details,
    imported = excluded.imported, active_excluded = excluded.active_excluded,
    error = excluded.error;`);
}

function emitQuestions() {
  const offset = Number(process.argv[3] ?? 0);
  const limit = Number(process.argv[4] ?? 50);
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 250) {
    throw new Error("Use: questions <offset> <limit>, with a limit from 1 to 250.");
  }
  const rows = database.prepare("select * from questions order by id limit ? offset ?").all(limit, offset);
  const values = rows.map((row) => `(
    ${literal(row.id)}::uuid, ${literal(row.display_id)}, ${literal(row.section)},
    ${literal(row.domain_code)}, ${literal(row.domain_name)}, ${literal(row.skill_code)},
    ${literal(row.skill_name)}, ${literal(row.difficulty)}, ${literal(row.type)},
    ${literal(row.stimulus_html)}, ${literal(row.stem_html)}, ${literal(row.rationale_html)},
    ${literal(row.answer_options)}::jsonb,
    array(select pg_catalog.jsonb_array_elements_text(${literal(row.correct_answers)}::jsonb)),
    ${boolean(row.is_active_test)}, ${boolean(row.is_retired)}, ${timestamp(row.source_updated_at)},
    ${literal(row.content_hash)}, ${row.sync_run_id == null ? "null" : `${literal(row.sync_run_id)}::uuid`},
    ${timestamp(row.created_at)}, ${timestamp(row.updated_at)}
  )`).join(",\n");
  if (!rows.length) process.stdout.write("select 0;");
  else process.stdout.write(`insert into public.questions (
    id, display_id, section, domain_code, domain_name, skill_code, skill_name,
    difficulty, type, stimulus_html, stem_html, rationale_html, answer_options,
    correct_answers, is_active_test, is_retired, source_updated_at, content_hash,
    sync_run_id, created_at, updated_at
  ) values ${values}
  on conflict (id) do update set
    display_id = excluded.display_id, section = excluded.section,
    domain_code = excluded.domain_code, domain_name = excluded.domain_name,
    skill_code = excluded.skill_code, skill_name = excluded.skill_name,
    difficulty = excluded.difficulty, type = excluded.type,
    stimulus_html = excluded.stimulus_html, stem_html = excluded.stem_html,
    rationale_html = excluded.rationale_html, answer_options = excluded.answer_options,
    correct_answers = excluded.correct_answers, is_active_test = excluded.is_active_test,
    is_retired = excluded.is_retired, source_updated_at = excluded.source_updated_at,
    content_hash = excluded.content_hash, sync_run_id = excluded.sync_run_id,
    created_at = excluded.created_at, updated_at = excluded.updated_at;`);
}

function emitClaim() {
  const tokenHash = process.argv[3];
  if (!/^[a-f0-9]{64}$/.test(tokenHash ?? "")) throw new Error("Pass a lowercase SHA-256 token hash.");
  const user = database.prepare("select id from user order by created_at limit 1").get();
  if (!user) throw new Error("The snapshot has no legacy user.");
  const payload = {
    practice_sessions: database.prepare("select id, mode, requested_count, status, topic_filters, created_at, completed_at, abandoned_at from practice_sessions where user_id = ? order by created_at").all(user.id).map((row) => ({
      ...row, topic_filters: JSON.parse(row.topic_filters), created_at: iso(row.created_at),
      completed_at: iso(row.completed_at), abandoned_at: iso(row.abandoned_at),
    })),
    practice_session_items: database.prepare("select i.session_id, i.question_id, i.position, i.first_attempt_correct, i.retry_count, i.resolved_at from practice_session_items i join practice_sessions s on s.id = i.session_id where s.user_id = ? order by i.session_id, i.position").all(user.id).map((row) => ({
      ...row, first_attempt_correct: row.first_attempt_correct == null ? null : Boolean(row.first_attempt_correct),
      resolved_at: iso(row.resolved_at),
    })),
    answer_attempts: database.prepare("select id, session_id, question_id, attempt_number, response, is_correct, created_at from answer_attempts where user_id = ? order by created_at").all(user.id).map((row) => ({
      ...row, is_correct: Boolean(row.is_correct), created_at: iso(row.created_at),
    })),
    user_question_progress: database.prepare("select question_id, status, first_attempt_misses, last_answered_at, mastered_at from user_question_progress where user_id = ? order by question_id").all(user.id).map((row) => ({
      ...row, last_answered_at: iso(row.last_answered_at), mastered_at: iso(row.mastered_at),
    })),
  };
  process.stdout.write(`insert into private.legacy_claims (token_hash, source_user_id, payload)
  values (decode('${tokenHash}', 'hex'), ${literal(user.id)}, ${literal(JSON.stringify(payload))}::jsonb)
  on conflict (token_hash) do nothing;`);
}

validateSnapshot();
if (command === "sync-runs") emitSyncRuns();
else if (command === "questions") emitQuestions();
else if (command === "claim") emitClaim();
else throw new Error("Use sync-runs, questions <offset> <limit>, or claim <sha256-hash>.");
