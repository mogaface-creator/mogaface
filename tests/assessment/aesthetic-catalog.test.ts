import test from "node:test";
import assert from "node:assert/strict";
import { ASSESSMENT_CATEGORIES, ASSESSMENT_CATALOG_COUNT } from "../../lib/assessment/aestheticCatalog.ts";
test("the descriptive catalog contains 169 distinct review labels in twelve categories",()=>{
 assert.equal(ASSESSMENT_CATALOG_COUNT,169);assert.equal(ASSESSMENT_CATEGORIES.length,12);
 assert.equal(new Set(ASSESSMENT_CATEGORIES.map(c=>c.id)).size,12);
 assert.deepEqual(ASSESSMENT_CATEGORIES.map(c=>c.items.length),[8,14,26,17,16,13,11,8,13,11,12,20]);
 for(const c of ASSESSMENT_CATEGORIES){assert.ok(c.method.length>20);assert.ok(c.limits.length>20);assert.equal(new Set(c.items).size,c.items.length);}
});
