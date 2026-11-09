import { describe, expect, it } from "vitest";
import {
  executeSql,
  ingestTabularData,
  detectDelimiter,
  normalizeSqlQuery,
  exportQueryResultToCsv,
  exportQueryResultToJson,
} from "./sql-engine";

const sampleEmployeeCsv = `department,salary,status
Engineering,120000,active
Engineering,140000,active
Marketing,95000,active
HR,80000,inactive`;

const sampleEmployeeTsv = `department\tsalary\tstatus
Engineering\t120000\tactive
Engineering\t140000\tactive
Marketing\t95000\tactive
HR\t80000\tinactive`;

describe("Spreadsheet SQL Engine (sql-engine)", () => {
  describe("Delimiter detection", () => {
    it("detects comma delimiter", () => {
      expect(detectDelimiter("name,age,city\nAlice,30,NYC")).toBe(",");
    });

    it("detects tab delimiter", () => {
      expect(detectDelimiter("name\tage\tcity\nAlice\t30\tNYC")).toBe("\t");
    });

    it("detects semicolon delimiter", () => {
      expect(detectDelimiter("name;age;city\nAlice;30;NYC")).toBe(";");
    });
  });

  describe("Ingestion & Numeric Column Detection", () => {
    it("ingests CSV data and correctly detects numeric columns", () => {
      const table = ingestTabularData(sampleEmployeeCsv);
      expect(table.tableName).toBe("table");
      expect(table.rowCount).toBe(4);
      expect(table.columns).toEqual([
        { name: "department", type: "text", sampleValues: ["Engineering", "Engineering", "Marketing", "HR"] },
        { name: "salary", type: "numeric", sampleValues: [120000, 140000, 95000, 80000] },
        { name: "status", type: "text", sampleValues: ["active", "active", "active", "inactive"] },
      ]);
      expect(typeof table.objects[0].salary).toBe("number");
      expect(table.objects[0].salary).toBe(120000);
    });

    it("ingests TSV data cleanly", () => {
      const table = ingestTabularData(sampleEmployeeTsv);
      expect(table.rowCount).toBe(4);
      expect(table.columns.find(c => c.name === "salary")?.type).toBe("numeric");
      expect(table.objects[1].salary).toBe(140000);
    });

    it("handles empty or missing numeric cells as null", () => {
      const csv = `product,price\nWidget,10.5\nGadget,\nDoohickey,25`;
      const table = ingestTabularData(csv);
      expect(table.objects[1].price).toBeNull();
      expect(table.objects[0].price).toBe(10.5);
    });

    it("throws clear error on empty input data", () => {
      expect(() => ingestTabularData("   ")).toThrow(/empty/i);
    });
  });

  describe("Query Normalization", () => {
    it("normalizes unbracketed table identifier to [table]", () => {
      expect(
        normalizeSqlQuery("SELECT department, COUNT(*), AVG(salary) FROM table WHERE status = 'active' GROUP BY department")
      ).toBe(
        "SELECT department, COUNT(*), AVG(salary) FROM [table] WHERE status = 'active' GROUP BY department"
      );
    });

    it("handles table aliases and table prefix", () => {
      expect(normalizeSqlQuery("SELECT table.department FROM table WHERE table.status = 'active'")).toBe(
        "SELECT [table].department FROM [table] WHERE [table].status = 'active'"
      );
    });

    it("preserves queries with table already bracketed or data table", () => {
      expect(normalizeSqlQuery("SELECT * FROM [table]")).toBe("SELECT * FROM [table]");
      expect(normalizeSqlQuery("SELECT * FROM data")).toBe("SELECT * FROM data");
    });
  });

  describe("Acceptance Criteria Query Execution", () => {
    it("executes the target acceptance criteria query flawlessly", async () => {
      const query = "SELECT department, COUNT(*), AVG(salary) FROM table WHERE status = 'active' GROUP BY department";
      const result = await executeSql(sampleEmployeeCsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(2);
      expect(result.columns).toEqual(["department", "COUNT(*)", "AVG(salary)"]);

      // Sort rows by department to make assertion deterministic
      const sortedRows = [...result.rows].sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      expect(sortedRows[0]).toEqual(["Engineering", 2, 130000]);
      expect(sortedRows[1]).toEqual(["Marketing", 1, 95000]);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("executes the target query against TSV data with alias data", async () => {
      const query = "SELECT department, COUNT(*), AVG(salary) FROM data WHERE status = 'active' GROUP BY department";
      const result = await executeSql(sampleEmployeeTsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(2);
      const engRow = result.rows.find(r => r[0] === "Engineering");
      expect(engRow).toBeDefined();
      expect(engRow?.[1]).toBe(2);
      expect(engRow?.[2]).toBe(130000);
    });
  });

  describe("Aggregations, Filtering, and Pagination", () => {
    it("computes MIN, MAX, SUM, and AVG aggregations correctly", async () => {
      const query = "SELECT COUNT(*) as count, MIN(salary) as min_sal, MAX(salary) as max_sal, SUM(salary) as total_sal, AVG(salary) as avg_sal FROM table";
      const result = await executeSql(sampleEmployeeCsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(1);
      expect(result.columns).toEqual(["count", "min_sal", "max_sal", "total_sal", "avg_sal"]);
      expect(result.rows[0]).toEqual([4, 80000, 140000, 435000, 108750]);
    });

    it("filters with WHERE and sorts with ORDER BY", async () => {
      const query = "SELECT department, salary FROM table WHERE salary > 90000 ORDER BY salary DESC";
      const result = await executeSql(sampleEmployeeCsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(3);
      expect(result.rows).toEqual([
        ["Engineering", 140000],
        ["Engineering", 120000],
        ["Marketing", 95000],
      ]);
    });

    it("supports pagination with LIMIT and OFFSET", async () => {
      const query = "SELECT department, salary FROM table ORDER BY salary ASC LIMIT 2 OFFSET 1";
      const result = await executeSql(sampleEmployeeCsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(2);
      expect(result.rows).toEqual([
        ["Marketing", 95000],
        ["Engineering", 120000],
      ]);
    });

    it("returns empty rows with inferred columns when WHERE condition matches nothing", async () => {
      const query = "SELECT department, salary FROM table WHERE salary > 1000000";
      const result = await executeSql(sampleEmployeeCsv, query);

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(0);
      expect(result.rows).toEqual([]);
      expect(result.columns).toEqual(["department", "salary"]);
    });
  });

  describe("Error Handling", () => {
    it("returns informative error when SQL query has syntax errors", async () => {
      const query = "SELEC * FROM table WHERE";
      const result = await executeSql(sampleEmployeeCsv, query);

      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/parse error/i);
      expect(result.rowCount).toBe(0);
    });

    it("returns informative error when input data is empty", async () => {
      const result = await executeSql("", "SELECT * FROM table");
      expect(result.error).toMatch(/input data is empty/i);
    });

    it("returns informative error when query is empty", async () => {
      const result = await executeSql(sampleEmployeeCsv, "   ");
      expect(result.error).toMatch(/query is empty/i);
    });

    it("returns informative error when CSV has malformed syntax", async () => {
      const malformedCsv = `a,b\n"unclosed quote,123`;
      const result = await executeSql(malformedCsv, "SELECT * FROM table");
      expect(result.error).toMatch(/csv parsing error/i);
    });
  });

  describe("Export Functions", () => {
    it("exports query result to RFC-4180 CSV", async () => {
      const query = "SELECT department, salary FROM table WHERE status = 'active' ORDER BY salary DESC";
      const result = await executeSql(sampleEmployeeCsv, query);

      const csv = exportQueryResultToCsv(result);
      expect(csv).toBe("department,salary\nEngineering,140000\nEngineering,120000\nMarketing,95000");
    });

    it("exports query result to formatted JSON", async () => {
      const query = "SELECT department, salary FROM table WHERE salary = 80000";
      const result = await executeSql(sampleEmployeeCsv, query);

      const json = exportQueryResultToJson(result);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual([{ department: "HR", salary: 80000 }]);
    });
  });
});
