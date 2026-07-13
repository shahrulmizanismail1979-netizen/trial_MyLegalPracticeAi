import React from "react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card py-12">
      <div className="container px-4">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block" data-testid="link-footer-home">
              <span className="text-2xl font-serif font-bold">
                MyAccident<span className="text-primary">Ai</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground leading-relaxed">
              The authoritative AI companion for Malaysian personal injury and accident law practitioners. Created by Prof Madya Dr Shahrul Mizan Ismail, Faculty of Law, Universiti Kebangsaan Malaysia.
            </p>
            <p className="mt-4 text-xs text-muted-foreground/70 max-w-md">
              Disclaimer: MyAccidentAi is a practice companion tool. All AI-generated research, documents, and calculations should be independently verified against primary legal sources before use in actual practice.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-foreground mb-4">Features</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-cases">Case Law Database</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-drafter">AI Document Drafter</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-calculator">AI Damages Calculator</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-workflows">Practice Workflows</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-generator">Cause Paper Generator</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-assistant">AI Legal Assistant</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-foreground mb-4">Practice Areas</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-mva">Motor Vehicle Accidents</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-workplace">Workplace Injuries</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-slip">Slip & Fall Cases</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-running">Running Down Matters</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-fatal">Fatal Accident Claims</Link></li>
              <li><Link href="/workspace" className="hover:text-primary transition-colors" data-testid="link-footer-medical">Medical Negligence</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/40 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} MyAccidentAi. All rights reserved.
          </p>
          <div className="flex space-x-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-primary transition-colors" data-testid="link-footer-login">Practitioner Login</Link>
            <Link href="/admin" className="hover:text-primary transition-colors" data-testid="link-footer-admin">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
