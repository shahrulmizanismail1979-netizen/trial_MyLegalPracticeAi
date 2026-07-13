import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { SectionId, DocumentDef } from '@/lib/data';
import { fetchMe } from '@/lib/subscription';
import type { Tier } from '@/lib/tier';

// Register once at module load: every generated API hook will attach the bearer
// token saved at login. Kept outside the component so it runs before any request.
setAuthTokenGetter(() => localStorage.getItem('convey_token'));

export type AiMode = 'tutor' | 'drafter' | 'risk' | 'checklist' | 'deadlines' | 'reviewer' | 'comparator' | 'title' | 'quotation' | 'advice' | 'duediligence' | 'opinion' | 'requisition' | 'completion' | 'caseresearch' | 'stampduty' | 'rpgt' | 'tenancy' | 'poa' | 'caveat' | 'landsearch' | 'devclaim' | 'bankruptcy' | 'foreignpurchase' | 'loandoc' | 'taxcompliance' | 'strata' | 'quiz' | 'simulator' | 'clauselib' | 'docanalyzer' | 'compliance' | 'timeline' | 'mockexam' | 'caseanalyzer' | 'corpresolution' | 'corpdd' | 'jvagreement' | 'guarantee';

export interface CurrentUser {
  id: number;
  username?: string;
  accessCode?: string;
  email?: string;
  displayName: string;
  role: string;
  tier?: Tier;
  grandfathered?: boolean;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
}

interface AppContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  activeSection: SectionId;
  setActiveSection: (section: SectionId) => void;
  isAiPanelOpen: boolean;
  setIsAiPanelOpen: (val: boolean) => void;
  aiMode: AiMode;
  setAiMode: (mode: AiMode) => void;
  selectedDocument: DocumentDef | null;
  setSelectedDocument: (doc: DocumentDef | null) => void;
  openDrafterWithDoc: (docTitle: string) => void;
  drafterInitialType: string;
  setDrafterInitialType: (type: string) => void;
  setAuthToken: (token: string | null) => void;
  refreshAccess: () => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('convey_auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const stored = localStorage.getItem('convey_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [activeSection, setActiveSection] = useState<SectionId>('theory');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('tutor');
  const [selectedDocument, setSelectedDocument] = useState<DocumentDef | null>(null);
  const [drafterInitialType, setDrafterInitialType] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('convey_auth', isAuthenticated.toString());
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentUser) {
      // Never persist the access code (the account's sole credential) to localStorage.
      const { accessCode: _omitAccessCode, ...persistable } = currentUser;
      localStorage.setItem('convey_user', JSON.stringify(persistable));
    } else {
      localStorage.removeItem('convey_user');
    }
  }, [currentUser]);

  const openDrafterWithDoc = (docTitle: string) => {
    setSelectedDocument(null);
    setAiMode('drafter');
    setDrafterInitialType(`Modification of ${docTitle}`);
    setIsAiPanelOpen(true);
  };

  const setAuthToken = (token: string | null) => {
    if (token) localStorage.setItem('convey_token', token);
    else localStorage.removeItem('convey_token');
  };

  const refreshAccess = async () => {
    try {
      const fresh = await fetchMe();
      setCurrentUser(fresh);
    } catch {
      // Non-fatal: keep the cached user if the refresh fails.
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('convey_auth');
    localStorage.removeItem('convey_user');
    localStorage.removeItem('convey_token');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        currentUser,
        setCurrentUser,
        activeSection,
        setActiveSection,
        isAiPanelOpen,
        setIsAiPanelOpen,
        aiMode,
        setAiMode,
        selectedDocument,
        setSelectedDocument,
        openDrafterWithDoc,
        drafterInitialType,
        setDrafterInitialType,
        setAuthToken,
        refreshAccess,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
