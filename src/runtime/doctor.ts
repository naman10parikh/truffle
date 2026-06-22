// src/runtime/doctor.ts — `truffle doctor` (CLI) + `truffle_doctor` (MCP): the engine health/feature probe.
//
// FEATURE-DETECTS the live engine version (never hard-codes — the brain caught WebFetch hallucinating Typesense
// dates, GAPS §4; doctor reads GET /version off the running engine). Reports the load-bearing operator facts
// (P1/P2/P5/P17): the write-model (Meili async — poll the task queue), the attribute-declaration rule (declare
// searchable/filterable EXPLICITLY), a RAM-vs-index reminder (in-memory engines are RAM-bound), and the
// pgvector≥0.8 + hnsw.iterative_scan rule for the filtered-ANN class (the setting truffle owns; the DB is acorn's).
//
// Honest when the engine is down: returns reachable:false with the boot hint — never fabricates a version.

import { MeiliClient, meiliConfigFromEnv } from "./meili-client.js";

export interface DoctorReport {
  reachable: boolean;
  engine_url: string;
  engine_version?: string;
  commit_date?: string;
  write_model: string;
  attrs_declared_rule: string;
  ram_estimate_rule: string;
  pgvector_ok: string;
  notes: string[];
}

async function doctorCore(engineUrl?: string): Promise<DoctorReport> {
  const cfg = meiliConfigFromEnv();
  const url = engineUrl ?? cfg.url;
  const client = new MeiliClient({ url, masterKey: cfg.masterKey });

  const reachable = await client.health();
  const report: DoctorReport = {
    reachable,
    engine_url: url,
    // P1 — Meili writes are ASYNC: poll GET /tasks/{uid} to succeeded before assuming searchability (S9).
    write_model: "meili: ASYNC writes — every write returns a taskUid; poll GET /tasks/{uid} to 'succeeded' before assuming searchability (P1/S9)",
    // P2 — declare attributes EXPLICITLY; defaults silently fail on filter/sort/facet/highlight.
    attrs_declared_rule: "declare searchableAttributes + filterableAttributes EXPLICITLY; undeclared filter/sort/facet attrs silently fail (P2)",
    // P5 — in-memory engines are RAM-bound; budget RAM ~ index size × 1.5 and test the DEPLOY-time spike.
    ram_estimate_rule: "in-memory engines are RAM-bound — budget RAM ≈ index size × ~1.5; vectors blow this up; test the DEPLOY spike, not just steady-state (P5)",
    // P17 — the filtered-ANN under-return class: pgvector ≥0.8 + hnsw.iterative_scan. The setting is truffle's; the DB is acorn's.
    pgvector_ok: "for the Postgres path: require pgvector ≥ 0.8 + SET hnsw.iterative_scan so filtered-ANN re-probes to LIMIT (P17/S4). The DB is acorn's; the iterative-scan SETTING is truffle's.",
    notes: [],
  };

  if (reachable) {
    try {
      const v = await client.version();
      if (v.pkgVersion) report.engine_version = v.pkgVersion; // feature-detected, NOT hard-coded
      if (v.commitDate) report.commit_date = v.commitDate;
      report.notes.push(`engine version feature-detected from GET /version (never hard-coded — GAPS §4)`);
    } catch (e) {
      report.notes.push(`could not read /version: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    report.notes.push(`engine not reachable at ${url} — boot it: \`truffle engine up --engine meili\` (or the CI services: block)`);
  }
  return report;
}

/** CLI entry: probe + print (human/JSON). Non-zero exit if the engine is unreachable (a real health failure). */
export async function doctor(opts: { engineUrl?: string; json?: boolean }): Promise<DoctorReport> {
  const report = await doctorCore(opts.engineUrl);
  if (typeof opts.json === "boolean") {
    if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else {
      process.stdout.write(`truffle doctor — engine ${report.engine_url}: ${report.reachable ? "reachable" : "UNREACHABLE"}\n`);
      if (report.engine_version) process.stdout.write(`  version: ${report.engine_version} (feature-detected)\n`);
      process.stdout.write(`  write-model: ${report.write_model}\n  attrs: ${report.attrs_declared_rule}\n  ram: ${report.ram_estimate_rule}\n  pgvector: ${report.pgvector_ok}\n`);
      for (const n of report.notes) process.stdout.write(`  note: ${n}\n`);
    }
    if (!report.reachable) process.exitCode = 1;
  }
  return report;
}
