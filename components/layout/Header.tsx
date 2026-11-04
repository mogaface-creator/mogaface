"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#why-glowup", label: "Why Glow-up" },
  { href: "/#assessments", label: "Assessments" },
  { href: "/#transformations", label: "Transformations" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function Header({ immersive = false }: { immersive?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  return (
    <header className={immersive ? `moga-nav ${scrolled || menuOpen ? "is-scrolled" : ""}` : "sticky top-0 z-50 border-b border-[#e6ebed] bg-white/95 backdrop-blur-md"}>
      <div className={immersive ? "moga-nav-inner" : "mx-auto flex min-h-18 max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6"}>
        <Link href="/" className="moga-wordmark flex items-center gap-3" aria-label="MOGA Home" onClick={() => setMenuOpen(false)}>
          <Image className="moga-brand-emblem" src="/images/brand/mogaface-artwork.png" width={46} height={46} alt="" />
          <span className="flex flex-col"><span className="text-lg font-medium tracking-[.13em] leading-none">MOGA</span><span className="moga-brand-caption mt-1 text-[8px] tracking-widest">Facial Aesthetics Intelligence</span></span>
        </Link>
        <nav aria-label="Main navigation" className={immersive ? "moga-desktop-nav" : "hidden lg:flex items-center gap-6 text-xs"}>
          {LINKS.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="flex items-center gap-5">
          <Link href="/test-lab" className={immersive ? "moga-testing-link" : "hidden sm:inline text-xs"}>Testing Lab</Link>
          <Link href="/#portal" className={immersive ? "moga-pill moga-nav-cta" : "rounded-full bg-[#182327] px-5 py-3 text-xs text-white"} onClick={() => setMenuOpen(false)}>Start my plan</Link>
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="moga-mobile-menu" className={immersive ? "moga-menu-button" : "lg:hidden p-2"} onClick={() => setMenuOpen(!menuOpen)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 8h16M4 16h16" />}</svg></button>
        </div>
      </div>
      {menuOpen && <nav id="moga-mobile-menu" aria-label="Mobile navigation" className={immersive ? "moga-mobile-menu" : "flex flex-col gap-5 bg-white p-6 text-sm lg:hidden"}>{LINKS.map(link => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}<span aria-hidden="true">↗</span></Link>)}<Link href="/test-lab" onClick={() => setMenuOpen(false)}>Testing Lab<span aria-hidden="true">↗</span></Link></nav>}
    </header>
  );
}
