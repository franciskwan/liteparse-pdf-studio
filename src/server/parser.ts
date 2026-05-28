import { LiteParse } from "@llamaindex/liteparse";
import type { ParseOptions } from "../shared/types";
import type { LiteParseResult } from "./markdown";

export async function parsePdf(buffer: Buffer, options: ParseOptions): Promise<LiteParseResult> {
  const parser = new LiteParse({
    ocrEnabled: options.ocrEnabled,
    ocrLanguage: options.ocrLanguage,
    maxPages: options.maxPages,
    targetPages: options.targetPages,
    dpi: options.dpi,
    preserveVerySmallText: options.preserveVerySmallText,
    quiet: true,
    numWorkers: 2,
  });

  return parser.parse(buffer) as Promise<LiteParseResult>;
}
