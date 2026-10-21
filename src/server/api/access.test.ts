import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertBaseAccess,
  assertColumnAccess,
  assertRowAccess,
  assertTableAccess,
  assertViewAccess,
} from "~/server/api/access";
import { baseRouter } from "~/server/api/routers/base";
import { createCallerFactory } from "~/server/api/trpc";
import { createFixture, resetDb, testDb } from "~/test/db";

// trpc.ts imports next-auth, which cannot be loaded under vitest's node ESM
// resolution. The tests inject the session through the caller context instead.
vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

async function setup() {
  const owner = await createFixture([
    { name: "Third", type: "string" },
    { name: "First", type: "string" },
    { name: "Second", type: "number" },
  ]);
  const other = await createFixture();
  const view = await testDb.view.create({
    data: { name: "Grid view", tableId: owner.table.id },
  });
  const row = await testDb.row.create({
    data: { tableId: owner.table.id, order: 0, data: { a: "b" } },
  });
  return { owner, other, view, row };
}

async function expectNotFound(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TRPCError);
  expect((err as TRPCError).code).toBe("NOT_FOUND");
}

beforeEach(resetDb);

describe("access helpers", () => {
  it("assertBaseAccess", async () => {
    const { owner, other } = await setup();
    const base = await assertBaseAccess(testDb, owner.user.id, owner.base.id);
    expect(base.id).toBe(owner.base.id);
    await expectNotFound(assertBaseAccess(testDb, other.user.id, owner.base.id));
    await expectNotFound(assertBaseAccess(testDb, owner.user.id, "nope"));
  });

  it("assertTableAccess returns columns in order", async () => {
    const { owner, other } = await setup();
    const table = await assertTableAccess(testDb, owner.user.id, owner.table.id);
    expect(table.id).toBe(owner.table.id);
    expect(table.columns.map((c) => c.id)).toEqual(
      owner.columns.map((c) => c.id),
    );
    expect(table.columns.map((c) => c.order)).toEqual([0, 1, 2]);
    await expectNotFound(
      assertTableAccess(testDb, other.user.id, owner.table.id),
    );
    await expectNotFound(assertTableAccess(testDb, owner.user.id, "nope"));
  });

  it("assertTableAccess breaks order ties by createdAt", async () => {
    const { owner } = await setup();
    const a = await testDb.column.create({
      data: { name: "tie-a", type: "string", tableId: owner.table.id, order: 9 },
    });
    const b = await testDb.column.create({
      data: { name: "tie-b", type: "string", tableId: owner.table.id, order: 9 },
    });
    const table = await assertTableAccess(testDb, owner.user.id, owner.table.id);
    const ids = table.columns.map((c) => c.id);
    expect(ids.slice(-2)).toEqual([a.id, b.id]);
  });

  it("assertColumnAccess", async () => {
    const { owner, other } = await setup();
    const col = owner.columns[0]!;
    const got = await assertColumnAccess(testDb, owner.user.id, col.id);
    expect(got.id).toBe(col.id);
    await expectNotFound(assertColumnAccess(testDb, other.user.id, col.id));
    await expectNotFound(assertColumnAccess(testDb, owner.user.id, "nope"));
  });

  it("assertViewAccess", async () => {
    const { owner, other, view } = await setup();
    const got = await assertViewAccess(testDb, owner.user.id, view.id);
    expect(got.id).toBe(view.id);
    await expectNotFound(assertViewAccess(testDb, other.user.id, view.id));
    await expectNotFound(assertViewAccess(testDb, owner.user.id, "nope"));
  });

  it("assertRowAccess returns only id and tableId", async () => {
    const { owner, other, row } = await setup();
    const got = await assertRowAccess(testDb, owner.user.id, row.id);
    expect(got).toEqual({ id: row.id, tableId: owner.table.id });
    await expectNotFound(assertRowAccess(testDb, other.user.id, row.id));
    await expectNotFound(assertRowAccess(testDb, owner.user.id, "nope"));
  });

  it("works inside a transaction", async () => {
    const { owner, other } = await setup();
    await testDb.$transaction(async (tx) => {
      const base = await assertBaseAccess(tx, owner.user.id, owner.base.id);
      expect(base.id).toBe(owner.base.id);
      await expectNotFound(assertBaseAccess(tx, other.user.id, owner.base.id));
    });
  });
});

describe("baseRouter ownership", () => {
  const callerFor = (id: string) =>
    createCallerFactory(baseRouter)({
      db: testDb,
      session: { user: { id }, expires: "2099-01-01" },
      headers: new Headers(),
    } as never);

  it("rejects updateBase from another user and leaves the base unchanged", async () => {
    const { owner, other } = await setup();
    await expectNotFound(
      callerFor(other.user.id).updateBase({
        baseId: owner.base.id,
        name: "hijacked",
      }),
    );
    const after = await testDb.base.findUnique({ where: { id: owner.base.id } });
    expect(after?.name).toBe(owner.base.name);
  });

  it("rejects deleteBase from another user and keeps the base", async () => {
    const { owner, other } = await setup();
    await expectNotFound(
      callerFor(other.user.id).deleteBase({ baseId: owner.base.id }),
    );
    expect(
      await testDb.base.findUnique({ where: { id: owner.base.id } }),
    ).not.toBeNull();
  });

  it("rejects a nonexistent base", async () => {
    const { owner } = await setup();
    await expectNotFound(
      callerFor(owner.user.id).updateBase({ baseId: "nope", name: "x" }),
    );
    await expectNotFound(callerFor(owner.user.id).deleteBase({ baseId: "nope" }));
  });

  it("lets the owner rename and delete", async () => {
    const { owner } = await setup();
    const caller = callerFor(owner.user.id);
    const renamed = await caller.updateBase({
      baseId: owner.base.id,
      name: "renamed",
    });
    expect(renamed.name).toBe("renamed");
    await caller.deleteBase({ baseId: owner.base.id });
    expect(
      await testDb.base.findUnique({ where: { id: owner.base.id } }),
    ).toBeNull();
  });
});
