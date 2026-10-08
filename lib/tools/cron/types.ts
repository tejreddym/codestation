export type CronValues = Record<string, string>;
export interface CronFieldBreakdown { label: string; expression: string; interpretation: string }
export interface CronResult {
  rows: { label: string; value: string }[];
  fields?: CronFieldBreakdown[];
}
