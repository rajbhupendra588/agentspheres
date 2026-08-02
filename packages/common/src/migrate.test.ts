import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checksumSql,
  parseMigrationFileName,
} from "./migrate.js";

describe("flyway migration naming", () => {
  it("parses Flyway versioned filenames", () => {
    assert.deepEqual(parseMigrationFileName("V1__registry_tenants_and_agents.sql"), {
      version: "1",
      description: "registry tenants and agents",
    });
    assert.deepEqual(parseMigrationFileName("V2__event_outbox.sql"), {
      version: "2",
      description: "event outbox",
    });
    assert.equal(parseMigrationFileName("README.md"), null);
    assert.equal(parseMigrationFileName("R__repeatable.sql"), null);
  });

  it("produces stable checksums", () => {
    const a = checksumSql("CREATE TABLE t (id INT);\n");
    const b = checksumSql("CREATE TABLE t (id INT);\n");
    const c = checksumSql("CREATE TABLE t (id TEXT);\n");
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});
