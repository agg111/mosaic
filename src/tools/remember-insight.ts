import { Type } from "@sinclair/typebox";
import { getClient } from "../hyperspell.js";

export const rememberInsightTool = {
  name: "mosaic_remember_insight",
  label: "Remember Insight",
  description:
    "Save a key insight or finding to memory so future reports can reference it. " +
    "Use when you discover something non-obvious — a competitor move, pricing signal, customer pattern, or market trend.",
  parameters: Type.Object({
    text: Type.String({
      description: "The insight to save, written as a clear self-contained fact.",
    }),
  }),
  async execute(_id: string, params: unknown) {
    const { text } = params as { text: string };
    try {
      const client = getClient();
      await client.memories.add({ text, metadata: { source: "mosaic" } });
      return { content: [{ type: "text" as const, text: "Insight saved." }] };
    } catch (e: any) {
      return {
        content: [{ type: "text" as const, text: `Failed to save insight: ${e.message}` }],
      };
    }
  },
};
