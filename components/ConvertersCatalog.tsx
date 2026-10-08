"use client";
import { converterCategories, converterEntries } from "@/config/converter-tools";
import ToolCatalog, { type ToolCategoryFilter } from "./ToolCatalog";

/** Compatibility adapter retaining the original ConvertersCatalog API. */
export default function ConvertersCatalog() {
  const filters: ToolCategoryFilter[] = converterCategories.map(category => ({ id: category.id, name: category.name, toolIds: converterEntries.filter(entry => entry.category.id === category.id).map(entry => String(entry.tool.id)) }));
  return <ToolCatalog name="Converters" heading="Converters" searchName="converter" tools={converterEntries.map(entry => entry.tool)} description="Browse registered conversion tools by family. Each card opens its canonical tool route." categoryFilters={filters} categoryLabels={Object.fromEntries(converterEntries.map(entry => [String(entry.tool.id), entry.category.name]))} emptyMessage="No converter tools match those filters." />;
}
