import { conversionCapabilities } from '@/config/conversion-capabilities';
import { getTool } from '@/config/tools';
export type Recipe = { version: 1; source: 'json' | 'json-array' | 'csv' | 'yaml'; steps: string[] };
const converters = new Set(['csv-to-json','json-to-csv','json-to-yaml','yaml-to-json']);
export const workflowSteps = [
  ...conversionCapabilities.filter(c => c.family === 'json-data' && converters.has(c.route.replace('/tools/',''))).map(c=>({slug:c.route.replace('/tools/',''),source:c.source,target:c.target})),
  ...['json-formatter','json-minifier','json-key-sorter'].map(slug=>({slug,source:'json',target:'same'}))
];
export function outputFormat(recipe: Recipe): string {
  let format: string = recipe.source;
  for (const slug of recipe.steps) {
    const step=workflowSteps.find(s=>s.slug===slug);
    if (!step || !getTool(slug) || !(step.source===format || (step.source==='json' && format==='json-array'))) throw new Error('These steps do not form a supported conversion. Choose a compatible next step.');
    if(step.target!=='same') format=step.target;
  }
  return format;
}
export function parseRecipe(raw:string):Recipe {
  if(raw.length>4000)throw new Error('Recipe is too large.');
  const value:unknown=JSON.parse(raw);
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Invalid recipe.');
  const r=value as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['version','source','steps'].includes(k)) || r.version!==1 || !['json','json-array','csv','yaml'].includes(String(r.source)) || !Array.isArray(r.steps) || !r.steps.length || r.steps.length>6 || r.steps.some(s=>typeof s!=='string'))throw new Error('Use a version 1 recipe with a supported source and 1–6 tool steps. Input data is not accepted in recipes.');
  const recipe=r as Recipe;outputFormat(recipe);return recipe;
}
export const recipePresets: {name:string;recipe:Recipe;sample:string}[] = [
 {name:'CSV → readable JSON',recipe:{version:1,source:'csv',steps:['csv-to-json','json-formatter']},sample:'name,score\nAda,9\nLin,7'},
 {name:'JSON → YAML → JSON',recipe:{version:1,source:'json',steps:['json-to-yaml','yaml-to-json','json-formatter']},sample:'{"name":"Ada","active":true}'},
 {name:'Sort and compact JSON',recipe:{version:1,source:'json',steps:['json-key-sorter','json-minifier']},sample:'{"z":3,"a":1}'}
];
