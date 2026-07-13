import React from "react";
import { Link } from "wouter";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" data-testid="link-home">
          <span className="text-2xl font-serif font-bold">
            MyAccident<span className="text-primary">Ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors" data-testid="link-login">
            Practitioner Login
          </Link>
          <Link href="/workspace" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" data-testid="link-workspace">
            Enter Workspace
          </Link>
        </div>
      </div>
    </nav>
  );
}
