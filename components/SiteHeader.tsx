"use client";

import Link from "next/link";
import { useState } from "react";
import ToolLauncher from "./ToolLauncher";
import ThemeToggle from "./ThemeToggle";
import StationMark from "./StationMark";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="header"><div className="shell nav">
    <Link className="brand" href="/" onClick={() => setOpen(false)}><StationMark />Code Station</Link>
    <button className="mobile-nav-toggle" type="button" aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(value => !value)}>{open ? "Close" : "Menu"}</button>
    <nav id="site-navigation" className={`nav-links ${open ? "is-open" : ""}`} aria-label="Primary">
      <Link href="/tools" onClick={() => setOpen(false)}>Tools</Link>
      <Link href="/#categories" onClick={() => setOpen(false)}>Stations</Link>
      <Link href="/workbench" onClick={() => setOpen(false)}>Workbench</Link>
      <Link href="/settings" onClick={() => setOpen(false)}>Settings</Link>
      <Link href="/about" onClick={() => setOpen(false)}>About</Link>
    </nav>
    <ToolLauncher />
    <ThemeToggle />
  </div></header>;
}
