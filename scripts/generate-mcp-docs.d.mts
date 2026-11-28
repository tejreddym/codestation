export const README_BEGIN_MARKER: string;
export const README_END_MARKER: string;

export interface GeneratedDocsResult {
  ok: boolean;
  catalogDrifted: boolean;
  readmeDrifted: boolean;
  catalog: {
    version: string;
    counts: {
      totalCatalogTools: number;
      executableTotal: number;
      freeExecutable: number;
      proExecutable: number;
      nodePure: number;
      nodeFileWired: number;
      nodeFileTotal: number;
      browserOnly: number;
      universalMetaTools: number;
      directTopTools: number;
      directTotal: number;
      stationsCount: number;
    };
    tools: Array<{
      slug: string;
      name: string;
      mcpName: string;
      tier: "free" | "pro";
      runtime: "node-pure" | "node-file";
      stationId: string;
      stationName: string;
      cliExample: string;
    }>;
  };
}

export function runGenerator(options?: {
  rootDir?: string;
  checkOnly?: boolean;
}): GeneratedDocsResult;
