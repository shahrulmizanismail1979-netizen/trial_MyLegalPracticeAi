import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface MatterState {
  caseId: string | null;
  pathwayId: string | null;
  analyzed: boolean;
  drafted: boolean;
  replied: boolean;
  /** Original files the user uploaded for this matter, kept so they can be
   *  filed into the Client Vault later. In-memory only (cleared on refresh). */
  sourceFiles: File[];
  setMatter: (caseId: string, pathwayId: string) => void;
  clearMatter: () => void;
  markAnalyzed: () => void;
  markDrafted: () => void;
  markReplied: () => void;
  addSourceFiles: (files: File[]) => void;
}

const MatterContext = createContext<MatterState | undefined>(undefined);

export function MatterProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [pathwayId, setPathwayId] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [replied, setReplied] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);

  const setMatter = useCallback((newCaseId: string, newPathwayId: string) => {
    setCaseId(newCaseId);
    setPathwayId(newPathwayId);
  }, []);

  const clearMatter = useCallback(() => {
    setCaseId(null);
    setPathwayId(null);
    setAnalyzed(false);
    setDrafted(false);
    setReplied(false);
    setSourceFiles([]);
  }, []);

  const markAnalyzed = useCallback(() => setAnalyzed(true), []);
  const markDrafted = useCallback(() => setDrafted(true), []);
  const markReplied = useCallback(() => setReplied(true), []);
  const addSourceFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    setSourceFiles((prev) => [...prev, ...files]);
  }, []);

  return (
    <MatterContext.Provider
      value={{
        caseId,
        pathwayId,
        analyzed,
        drafted,
        replied,
        sourceFiles,
        setMatter,
        clearMatter,
        markAnalyzed,
        markDrafted,
        markReplied,
        addSourceFiles,
      }}
    >
      {children}
    </MatterContext.Provider>
  );
}

export function useMatter() {
  const context = useContext(MatterContext);
  if (context === undefined) {
    throw new Error("useMatter must be used within a MatterProvider");
  }
  return context;
}
