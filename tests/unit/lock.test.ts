import { describe, expect, it } from "vitest";

import { withCharacterLock } from "@/lib/storage/lock";

describe("character lock", () => {
  it("serializes calls for the same character", async () => {
    const order: string[] = [];

    const first = withCharacterLock(42, async () => {
      order.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("first-end");
    });

    const second = withCharacterLock(42, async () => {
      order.push("second");
    });

    await Promise.all([first, second]);

    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});