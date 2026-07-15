import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setApiGate } from "./api";

export type Gate = "civil" | "criminal" | "advisory";

export const GATE_INFO: Record<Gate, {
  en: string;
  bm: string;
  ar: string;
  shortEn: string;
  shortBm: string;
  descEn: string;
  descBm: string;
  color: string;
  icon: string;
}> = {
  civil: {
    en: "Syariah Civil Litigation",
    bm: "Litigasi Sivil Syariah",
    ar: "التقاضي المدني الشرعي",
    shortEn: "Civil",
    shortBm: "Sivil",
    descEn: "Family law, divorce, custody, maintenance, inheritance, matrimonial assets, wakaf, wasiat, and related civil disputes in the Shariah courts.",
    descBm: "Undang-undang keluarga, perceraian, hadhanah, nafkah, harta pusaka, harta sepencarian, wakaf, wasiat, dan pertikaian sivil di mahkamah Syariah.",
    color: "emerald",
    icon: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9",
  },
  criminal: {
    en: "Syariah Criminal Litigation",
    bm: "Litigasi Jenayah Syariah",
    ar: "التقاضي الجنائي الشرعي",
    shortEn: "Criminal",
    shortBm: "Jenayah",
    descEn: "Shariah criminal offences, hudud, ta'zir, qisas, criminal procedure, prosecution and defence in Shariah Criminal Courts.",
    descBm: "Kesalahan jenayah Syariah, hudud, ta'zir, qisas, tatacara jenayah, pendakwaan dan pembelaan di Mahkamah Jenayah Syariah.",
    color: "rose",
    icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  },
  advisory: {
    en: "Syariah Legal Advisory & Consultancy",
    bm: "Khidmat Nasihat & Konsultansi Undang-Undang Syariah",
    ar: "الاستشارات القانونية الشرعية",
    shortEn: "Advisory",
    shortBm: "Nasihat",
    descEn: "Legal opinions, Shariah compliance, Islamic finance & banking, contracts, fatwa research, corporate advisory, kitab references and academic consultancy.",
    descBm: "Pendapat undang-undang, pematuhan Syariah, kewangan & perbankan Islam, kontrak, kajian fatwa, nasihat korporat, rujukan kitab dan khidmat akademik.",
    color: "amber",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
};

interface GateContextType {
  gate: Gate | null;
  setGate: (g: Gate | null) => void;
}

const GateContext = createContext<GateContextType | undefined>(undefined);
const STORAGE_KEY = "mysyariahai.gate";

export function GateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const initialRender = useRef(true);
  const [gate, setGateState] = useState<Gate | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const g = (saved as Gate | null) || null;
    setApiGate(g);
    return g;
  });

  const setGate = (g: Gate | null) => {
    setGateState(g);
    setApiGate(g);
    if (typeof window !== "undefined") {
      if (g) window.localStorage.setItem(STORAGE_KEY, g);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    setApiGate(gate);
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    queryClient.invalidateQueries();
  }, [gate, queryClient]);

  return (
    <GateContext.Provider value={{ gate, setGate }}>
      {children}
    </GateContext.Provider>
  );
}

export function useGate() {
  const ctx = useContext(GateContext);
  if (ctx === undefined) throw new Error("useGate must be used within GateProvider");
  return ctx;
}
