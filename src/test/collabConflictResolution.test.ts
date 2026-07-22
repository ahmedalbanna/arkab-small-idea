// @vitest-environment node
/**
 * CRDT Conflict Resolution Tests
 *
 * These tests demonstrate and verify Yjs's automatic conflict resolution
 * behavior. Yjs is a CRDT (Conflict-free Replicated Data Type) — concurrent
 * edits from multiple peers are merged deterministically without a central
 * conflict resolution step. The merge algorithm uses a hybrid logical clock
 * (Lamport timestamp + peer ID) so that every operation is causally ordered.
 *
 * Key guarantees:
 * 1. No data loss: concurrent inserts from different peers both survive
 * 2. Deterministic merge: given the same set of operations, all peers
 *    converge to the same state
 * 3. No locking: peers can edit the same region simultaneously
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

describe("CRDT conflict resolution (Yjs)", () => {
  /**
   * Simulates two peers editing the same Y.Text concurrently and then
   * exchanging their updates. Both peers should end up with the same
   * merged document containing all edits.
   */
  it("merges concurrent text inserts from two peers without data loss", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const text1 = doc1.getText("content");
    const text2 = doc2.getText("content");

    // Both peers start from the same base state
    text1.insert(0, "Hello ");
    text2.insert(0, "Hello ");

    // Simulate a sync by exchanging the initial update
    const update1to2 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, update1to2);

    // Now both peers make concurrent, conflicting edits at the same position
    // Peer 1 inserts "Alice" after "Hello "
    text1.insert(6, "Alice");

    // Peer 2 inserts "Bob" after "Hello " (at the same position 6)
    text2.insert(6, "Bob");

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(doc1);
    const updateB = Y.encodeStateAsUpdate(doc2);
    Y.applyUpdate(doc1, updateB);
    Y.applyUpdate(doc2, updateA);

    // Both peers must converge to the same final state
    expect(text1.toString()).toBe(text2.toString());

    // All content is preserved (no data loss)
    const merged = text1.toString();
    expect(merged).toContain("Hello");
    expect(merged).toContain("Alice");
    expect(merged).toContain("Bob");
  });

  /**
   * Demonstrates that inserting at the same position produces a
   * deterministic order based on peer IDs and logical clocks.
   */
  it("concurrent inserts at same position produce deterministic ordering", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const text1 = doc1.getText("content");
    const text2 = doc2.getText("content");

    // Set base content
    text1.insert(0, "[]");
    // Sync
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both peers insert at position 1 (inside the brackets)
    text1.insert(1, "A");
    text2.insert(1, "B");

    // Exchange updates and merge
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both peers converge
    expect(text1.toString()).toBe(text2.toString());

    // Both characters are preserved
    const result = text1.toString();
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("[");
    expect(result).toContain("]");
  });

  /**
   * Deletions and concurrent edits: one peer deletes, the other edits
   * the same region. Yjs should preserve the edit while also applying
   * the deletion where possible.
   */
  it("handles concurrent delete and insert at overlapping positions", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const text1 = doc1.getText("content");
    const text2 = doc2.getText("content");

    // Base: "abc"
    text1.insert(0, "abc");
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Peer 1 deletes "b" → "ac"
    text1.delete(1, 1);

    // Peer 2 inserts "X" at position 1 (before "b") → "aXbc"
    text2.insert(1, "X");

    // Exchange updates
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both converge
    expect(text1.toString()).toBe(text2.toString());

    // The insert should survive, and the delete should be applied
    // Expected: "aXc" (the "b" is deleted, "X" is inserted)
    const result = text1.toString();
    expect(result).toBe("aXc");
  });

  /**
   * Y.Map concurrent assignment — last-writer-wins per key.
   */
  it("resolves concurrent map writes with last-writer-wins (LWW)", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const map1 = doc1.getMap("meta");
    const map2 = doc2.getMap("meta");

    // Base state
    map1.set("title", "Draft");
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Peer 1 sets title to "Final"
    map1.set("title", "Final");

    // Peer 2 concurrently sets title to "Revised"
    map2.set("title", "Revised");

    // Exchange updates
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both converge to the same state (LWW — one value wins)
    expect(map1.get("title")).toBe(map2.get("title"));

    // The value is one of the two (deterministic based on peer ID / clock)
    const mergedValue = map1.get("title") as string;
    expect(["Final", "Revised"]).toContain(mergedValue);
  });

  /**
   * Y.Array — inserts from different peers interleave deterministically.
   */
  it("merges concurrent array inserts deterministically", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const arr1 = doc1.getArray("items");
    const arr2 = doc2.getArray("items");

    // Both start with ["a", "b", "c"]
    arr1.insert(0, ["a", "b", "c"]);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Peer 1 inserts "x" at position 2: [a, b, x, c]
    arr1.insert(2, ["x"]);
    // Peer 2 inserts "y" at position 2: [a, b, y, c]
    arr2.insert(2, ["y"]);

    // Exchange
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both converge
    expect(arr1.toArray()).toEqual(arr2.toArray());

    // All items are present
    const merged = arr1.toArray();
    expect(merged).toContain("a");
    expect(merged).toContain("b");
    expect(merged).toContain("c");
    expect(merged).toContain("x");
    expect(merged).toContain("y");

    // Both "x" and "y" end up at position 2 and 3 (or 3 and 2)
    // — the relative ordering is deterministic
    expect(merged.length).toBe(5);
  });

  /**
   * Three-way merge: three peers all edit concurrently and sync in a
   * peer-to-peer topology. All peers must eventually converge.
   */
  it("converges with three peers in a peer-to-peer topology", () => {
    const docs = [new Y.Doc(), new Y.Doc(), new Y.Doc()];
    const texts = docs.map((d) => d.getText("content"));

    // Base state: "Hello "
    texts[0].insert(0, "Hello ");
    for (let i = 1; i < 3; i++) {
      Y.applyUpdate(docs[i], Y.encodeStateAsUpdate(docs[0]));
    }

    // Each peer inserts a different name
    texts[0].insert(6, "Alice ");
    texts[1].insert(6, "Bob ");
    texts[2].insert(6, "Carol ");

    // Each syncs with each other (full mesh)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        Y.applyUpdate(docs[j], Y.encodeStateAsUpdate(docs[i]));
      }
    }

    // All peers converge
    expect(texts[0].toString()).toBe(texts[1].toString());
    expect(texts[1].toString()).toBe(texts[2].toString());

    const merged = texts[0].toString();
    expect(merged).toContain("Hello");
    expect(merged).toContain("Alice");
    expect(merged).toContain("Bob");
    expect(merged).toContain("Carol");
  });
});
