/**
 * Tool registry — add new tools here and they are automatically registered with OpenClaw.
 *
 * To add a tool:
 *   1. Create src/tools/your-tool.ts following the existing pattern
 *   2. Import it below and add to MOSAIC_TOOLS
 */

import { searchMemoriesTool } from "./search-memories.js";
import { webSearchTool } from "./web-search.js";
import { rememberInsightTool } from "./remember-insight.js";
import { generateReportTool } from "./generate-report.js";

export const MOSAIC_TOOLS = [
  // Memory & knowledge
  searchMemoriesTool,
  rememberInsightTool,

  // Web research
  webSearchTool,

  // Orchestrated workflows
  generateReportTool,
];
