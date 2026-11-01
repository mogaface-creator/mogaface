"use client";
import { useState } from "react";
import { ASSESSMENT_CATEGORIES, ASSESSMENT_CATALOG_COUNT } from "@/lib/assessment/aestheticCatalog.ts";

export function QovesAssessmentsExplorer() {
  const [activeId, setActiveId] = useState(ASSESSMENT_CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const current = ASSESSMENT_CATEGORIES.find(zone => zone.id === activeId) ?? ASSESSMENT_CATEGORIES[0];
  const matches = current.items.filter(item => item.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section id="assessments" className="border-b border-[#e6ebed] bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">A clear review framework</p>
          <h2 className="mt-4 text-3xl font-medium leading-[1.12] tracking-tight text-[#141e22] sm:text-5xl">{ASSESSMENT_CATALOG_COUNT} appearance review items</h2>
          <p className="mt-4 text-base text-[#556970] sm:text-lg">Explore what each category covers and what photographs can establish. A catalog item is not a completed test: findings depend on visibility and usable evidence, and some require in-person assessment.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-2 pb-2" role="group" aria-label="Assessment categories">
          {ASSESSMENT_CATEGORIES.map(zone => (
            <button key={zone.id} type="button" aria-pressed={zone.id === activeId} onClick={() => {setActiveId(zone.id);setQuery("");}}
              className={`rounded-full px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${zone.id === activeId ? "bg-[#182327] text-white" : "bg-[#f5f8f9] text-[#55686f] hover:bg-[#eaf0f2]"}`}>
              {zone.name}<span className="ml-1.5 opacity-70">({zone.items.length})</span>
            </button>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-[#e2e7e9] bg-[#fafcfc] p-7 sm:p-10">
          <div className="flex flex-col justify-between gap-5 border-b border-[#e8eded] pb-6 sm:flex-row sm:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#73888f]">{current.items.length} catalog items</p><h3 className="mt-1 text-2xl font-medium text-[#141e22] sm:text-3xl">{current.name}</h3></div>
            <label className="text-xs text-[#556970]">Find an item<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${current.name.toLowerCase()}`} className="mt-1 block min-h-11 w-full rounded-lg border border-[#dce5e8] bg-white px-3 text-sm text-[#182327]" /></label>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div><h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#697d84]">Items in this category</h4><ul className="grid gap-3 sm:grid-cols-2">{matches.map(item=><li key={item} className="text-sm text-[#45585f]">{item}</li>)}</ul><p className="mt-4 text-xs text-[#71858c]" aria-live="polite">{matches.length ? `${matches.length} of ${current.items.length} items shown` : "No matching items in this category."}</p></div>
            <div className="rounded-xl border border-[#e2e7e9] bg-white p-6"><h4 className="text-xs font-bold uppercase tracking-wider text-[#697d84]">How it can be reviewed</h4><p className="mt-3 text-sm leading-relaxed text-[#182327]">{current.method}</p><h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-[#697d84]">What remains uncertain</h4><p className="mt-3 text-sm leading-relaxed text-[#556970]">{current.limits}</p><p className="mt-6 border-t border-[#f0f4f6] pt-4 text-xs text-[#71858c]">AI previews are illustrative. They are not diagnoses, guaranteed identity locks or predicted treatment results.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
