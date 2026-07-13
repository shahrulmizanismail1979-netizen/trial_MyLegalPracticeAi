import React from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { Database } from "@/components/sections/database";
import { AIFeatures } from "@/components/sections/ai-features";
import { PracticeAreas } from "@/components/sections/practice-areas";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Testimonials } from "@/components/sections/testimonials";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <AIFeatures />
        <Database />
        <PracticeAreas />
        <HowItWorks />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
