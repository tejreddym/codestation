export const SQL_DIALECTS = ["PostgreSQL", "MySQL", "SQLite", "SQL Server"] as const;
export type SqlDialect = typeof SQL_DIALECTS[number];
export const VALUE_TYPES = ["String", "Number", "Boolean", "NULL"] as const;
export type SqlValueType = typeof VALUE_TYPES[number];
export interface SqlLiteral { type: SqlValueType; value: string }
export const CONDITION_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"] as const;
export type ConditionOperator = typeof CONDITION_OPERATORS[number];
export interface SqlCondition { column: string; operator: ConditionOperator; values: SqlLiteral[] }
export interface SqlAssignment { column: string; value: SqlLiteral }
export interface SqlOrder { column: string; direction: "ASC" | "DESC" }
export type SqlValues = Record<string, unknown>;
export interface SqlColumn { name: string; dataType: string; primaryKey: boolean; nullable?: boolean }
export interface SqlForeignKey { columns: string[]; referencedTable: string; referencedColumns: string[] }
export interface SqlTable { name: string; columns: SqlColumn[]; primaryKeys: string[]; foreignKeys: SqlForeignKey[] }
export interface SqlRelationship { fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[] }
export interface SqlSchema { tables: SqlTable[]; relationships: SqlRelationship[] }
export interface SqlResult { rows: { label: string; value: string }[]; warnings?: string[]; schema?: SqlSchema }
