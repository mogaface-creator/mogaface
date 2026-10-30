import test from "node:test";
import assert from "node:assert/strict";
import { parseComparison, comparisonSummary, COMPARISON_REGIONS } from "../../lib/submissions/imageReview.ts";
const rows=COMPARISON_REGIONS.map(region=>({region,original:"Natural source detail.",change:"No clear visible difference.",status:"no_clear_change",artifacts:"Cannot establish finer detail."}));
test("comparison requires all regions once and valid evidence statuses",()=>{
 assert.equal(parseComparison(rows)?.length,5);
 for(const invalid of [[],rows.slice(1),[...rows.slice(1),rows[1]],rows.map(r=>({...r,status:"improved"})),rows.map(r=>({...r,change:""}))]) assert.equal(parseComparison(invalid),null);
});
test("unapproved or missing comparisons never become reported enhancements",()=>{
 assert.match(comparisonSummary(),/No verified/);
 const comparison=parseComparison(rows)!;
 const checks={samePerson:true,naturalTexture:true,preservedLighting:true,preservedUnselectedAreas:true,subtleChanges:true};
 assert.match(comparisonSummary({status:"approved",checks,reason:"",comparison}),/no clear change/);
 assert.match(comparisonSummary({status:"rejected",checks,reason:"",comparison}),/No verified/);
});
