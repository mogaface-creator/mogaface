import React from "react";

export function AsSeenInMarquee() {
  return (
    <div className="w-full border-y border-[#e6ebed] bg-[#fafcfc] py-7 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-[#7d8f95] mb-6">
          As Seen In
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
          {/* USA Today */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-serif text-lg font-bold tracking-tight text-[#2d3a3f]">USA TODAY</span>
          </div>

          {/* The Guardian */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-serif text-lg font-bold tracking-tight text-[#2d3a3f]">The Guardian</span>
          </div>

          {/* Daily Mail */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-sans text-base font-extrabold tracking-wider text-[#2d3a3f]">Daily Mail</span>
          </div>

          {/* Business Insider */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-sans text-sm font-bold uppercase tracking-widest text-[#2d3a3f]">BUSINESS INSIDER</span>
          </div>

          {/* The Sun */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-sans text-base font-black italic tracking-tighter text-[#2d3a3f]">The Sun</span>
          </div>

          {/* Cosmopolitan */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-serif text-sm font-semibold uppercase tracking-[0.15em] text-[#2d3a3f]">COSMOPOLITAN</span>
          </div>

          {/* MIT Tech Review */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-mono text-xs font-bold uppercase tracking-tight text-[#2d3a3f]">MIT Technology Review</span>
          </div>

          {/* GQ */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-serif text-xl font-black tracking-tight text-[#2d3a3f]">GQ</span>
          </div>

          {/* Wired */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-mono text-base font-bold tracking-widest text-[#2d3a3f]">WIRED</span>
          </div>

          {/* New York Post */}
          <div className="h-6 flex items-center justify-center hover:opacity-100 transition-opacity">
            <span className="font-serif text-base font-bold italic tracking-tight text-[#2d3a3f]">NEW YORK POST</span>
          </div>
        </div>
      </div>
    </div>
  );
}
