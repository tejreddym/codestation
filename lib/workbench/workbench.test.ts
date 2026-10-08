import {describe,it,expect} from 'vitest';
import {detectTools,detectionLimit} from './detection';
import {parsePreferences,defaultPreferences} from './preferences';
import {parseRecipe,recipePresets,outputFormat} from './workflows';
import {validateBatch,batchFilename} from './batch';
import {getTool} from '@/config/tools';
import {runDataTool} from '@/lib/tools/json-data';
describe('Smart Detection',()=>{
 it.each([['#D9F975','color-converter'],['#abcd','color-converter'],['550e8400-e29b-41d4-a716-446655440000','uuid-parser'],['https://example.com/a?b=2','url-parser'],['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2ln','jwt-decoder']])('routes %s without executing it',(value,slug)=>{expect(detectTools(value)).toEqual([expect.objectContaining({slug,confidence:'high'})]);expect(getTool(slug)).toBeTruthy();});
 it('leaves JSON ambiguous and malformed content nonautomatic',()=>{expect(detectTools('{"a":1}')).toHaveLength(3);expect(detectTools('{oops}')[0].confidence).toBe('possible');expect(detectTools('SGVsbG8gd29ybGQ=')[0]).toMatchObject({slug:'base64-decoder',confidence:'possible'});});
 it.each(['#abcde','file:///etc/passwd','javascript:alert(1)','bad.jwt.token','ordinary words'])('does not auto-route %s',value=>expect(detectTools(value).every(m=>m.confidence==='possible')).toBe(true));
 it('handles empty and oversized input without truncation',()=>{expect(detectTools('  ')).toEqual([]);expect(()=>detectTools('x'.repeat(detectionLimit+1))).toThrow('200,000');});
});
describe('Preference storage',()=>{
 it('rejects unknown tools, deduplicates IDs and strips content',()=>{const result=parsePreferences(JSON.stringify({favorites:['json-formatter','bad','json-formatter'],recent:['bad'],input:'secret',autoDetect:'true'}),new Set(['json-formatter']));expect(result).toEqual({...defaultPreferences,favorites:['json-formatter']});expect(JSON.stringify(result)).not.toContain('secret');});
 it.each([null,'{','null','[]'])('recovers malformed preference %s',raw=>expect(parsePreferences(raw,new Set())).toEqual(defaultPreferences));
});
describe('Recipes use real engines',()=>{
 it.each(recipePresets)('$name runs in order without modifying source',async preset=>{let value=preset.sample;const recipe=parseRecipe(JSON.stringify(preset.recipe));for(const slug of recipe.steps){const tool=getTool(slug)!;const defaults=Object.fromEntries(tool.dataContract!.fields.map(f=>[f.name,f.defaultValue??'']));value=(await runDataTool(slug,{...defaults,input:value})).text;}expect(()=>JSON.parse(value)).not.toThrow();expect(outputFormat(recipe)).toMatch(/^json/);});
 it.each([{version:1,source:'csv',steps:['json-minifier']},{version:1,source:'json',steps:['imaginary-tool']},{version:1,source:'json',steps:['json-minifier'],input:'secret'},{version:1,source:'json',steps:Array(7).fill('json-minifier')}])('rejects invalid or content-bearing recipes',recipe=>expect(()=>parseRecipe(JSON.stringify(recipe))).toThrow());
});
describe('Batch boundaries',()=>{
 it('bounds count, source file size and combined memory',()=>{expect(()=>validateBatch([])).toThrow();expect(()=>validateBatch(Array(21).fill({size:1}))).toThrow('20');expect(()=>validateBatch([{size:17*1024*1024}])).toThrow('16');expect(()=>validateBatch(Array(5).fill({size:16*1024*1024}))).toThrow('64');expect(()=>validateBatch([{size:100}])).not.toThrow();});
 it('produces unique safe filenames without traversals',()=>{expect(batchFilename('../../photo.png',0,'jpg')).toBe('01-______photo.jpg');expect(batchFilename('photo.png',1,'jpg')).not.toBe(batchFilename('photo.png',0,'jpg'));});
});
