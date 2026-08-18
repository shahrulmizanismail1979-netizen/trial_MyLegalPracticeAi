import React from "react";
import { Link } from "wouter";
import { Scale, BookOpen, FileText, Activity, ShieldAlert, BadgeInfo, Scale3D } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-background pt-24 pb-32">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-luminosity"></div>
      
      <div className="container relative z-10 mx-auto px-4 text-center">
        <Badge variant="outline" className="mb-8 border-primary/30 text-primary bg-primary/5 px-4 py-1.5 text-sm" data-testid="hero-badge">
          The Authoritative Companion for Accident & Personal Injury Practice
        </Badge>
        
        <h1 className="mx-auto max-w-4xl font-serif text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Malaysian Accident, Personal Injury & Running Down
          <span className="block mt-2 text-primary italic font-medium">Practice Companion</span>
        </h1>
        
        <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          A comprehensive digital law library, AI-powered research suite, and interactive practice toolkit designed specifically for Malaysian practitioners handling complex motor vehicle accidents and workplace injuries.
        </p>
        
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/workspace" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="btn-access-workspace">
            Access Workspace
          </Link>
          <a href="#features" className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-base font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="btn-explore-features">
            Explore Features
          </a>
        </div>
        
        <div className="mt-20 pt-10 border-t border-border/50">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: "25 Theory Topics", icon: BookOpen },
              { label: "120 Case Laws", icon: Scale },
              { label: "75 Cause Papers", icon: FileText },
              { label: "20 Workflows", icon: Activity },
              { label: "50 Sample Documents", icon: FileText },
              { label: "Costs & Fees", icon: BadgeInfo },
              { label: "110 Glossary Terms", icon: ShieldAlert },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm" data-testid={`stat-${stat.label.replace(/\s+/g, '-').toLowerCase()}`}>
                <stat.icon className="h-4 w-4 text-primary" />
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
