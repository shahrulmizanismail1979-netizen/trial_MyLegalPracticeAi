import React from 'react';
import { BookOpen, GitCommit, PenTool, Briefcase, Calculator, BookMarked } from 'lucide-react';

export type SectionId = 'theory' | 'workflows' | 'forms' | 'jurisprudence' | 'costs' | 'terminology';

export interface NavItem {
  id: SectionId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_MENU: NavItem[] = [
  { id: 'theory', title: 'Part 1: Substantive Law', icon: BookOpen },
  { id: 'workflows', title: 'Part 2: 100 Conveyancing Workflows', icon: GitCommit },
  { id: 'forms', title: 'Part 3: Forms & Drafting', icon: PenTool },
  { id: 'jurisprudence', title: 'Part 4: 100 Leading Cases', icon: Briefcase },
  { id: 'costs', title: 'Part 5: Costs & Fees Assessor', icon: Calculator },
  { id: 'terminology', title: 'Part 6: Legal Terminology', icon: BookMarked },
];

export const MOCK_CASES = [
  {
    id: 'case_001',
    title: 'Macon Works & Trading v. Phang Hon Yin',
    citation: '[1976] 2 MLJ 177',
    topic: 'Specific Performance in SPA',
    facts: 'Vendor refused to complete the sale after SPA was signed and deposit paid. Purchaser sued for specific performance.',
    held: 'Specific performance granted. Damages are inadequate where land is involved.',
    diagram: {
      parties: ['Vendor (Refuses to sell)', 'Purchaser (Paid deposit)'],
      issue: 'Can Purchaser force the sale?',
      result: 'Yes. Specific Performance ordered.'
    }
  },
  {
    id: 'case_002',
    title: 'Adorna Properties Sdn Bhd v Boonsom Boonyanit',
    citation: '[2001] 1 MLJ 241',
    topic: 'Indefeasibility of Title (Forged Transfer)',
    facts: 'A forged document transferred the landowners property to Adorna Properties. Adorna bought it in good faith.',
    held: 'Under s.340(3) NLC, immediate purchaser in good faith gets indefeasible title (Note: Later corrected by Tan Ying Hong case).',
    diagram: {
      parties: ['Boonsom (Original Owner)', 'Adorna (Bona Fide Purchaser)'],
      issue: 'Does forgery defeat immediate bona fide title?',
      result: 'No (At the time). Adorna kept the title.'
    }
  },
  {
    id: 'case_003',
    title: 'Tan Hee Juan v Teh Boon Keat',
    citation: '[1934] 1 MLJ 96',
    topic: 'Capacity of Minors in Contracts',
    facts: 'A minor executed transfers of land in favor of the defendants. Upon reaching majority, sought to set aside the transfers.',
    held: 'The transfers were void under the Contracts Act as minors lack capacity to contract.',
    diagram: {
      parties: ['Minor (Transferred Land)', 'Defendant (Received Land)'],
      issue: 'Is a land transfer by a minor valid?',
      result: 'No. The contract is void ab initio.'
    }
  }
];

export type DocumentType = 'template' | 'pdf_placeholder';

export interface DocumentDef {
  id: string;
  title: string;
  type: DocumentType;
  content: string;
}

export interface WorkflowStep {
  id: number;
  label: string;
  documents?: DocumentDef[];
}

export interface Workflow {
  id: string;
  title: string;
  steps: WorkflowStep[];
}

export const MOCK_FLOWCHARTS: Workflow[] = [
  {
    id: 'flow_001',
    title: 'Standard Sub-sale (Freehold, Individual Title)',
    steps: [
      { 
        id: 1, 
        label: 'Payment of Earnest Deposit (2-3%) & Offer to Purchase',
        documents: [
          { 
            id: 'doc_1a', 
            title: 'Letter of Offer to Purchase (OTP)', 
            type: 'template', 
            content: 'LETTER OF OFFER TO PURCHASE\n\nDate: [Date]\n\nTo: [Vendor Name / NRIC]\n\nDear Sir/Madam,\n\nPROPERTY: [Full Property Address including Title Details]\n\nI/We, [Purchaser Name] (NRIC: [NRIC]) hereby offer to purchase the above Property on an "as is where is" basis at the purchase price of RM[Total Price] subject to the following terms:\n\n1. Earnest Deposit of 2% (RM[Amount]) is paid herewith to [Real Estate Agency / Solicitor] as stakeholders.\n2. The balance deposit of 8% (RM[Amount]) shall be paid upon the execution of the Sale and Purchase Agreement (SPA).\n3. The SPA shall be executed within fourteen (14) working days from the date of vendor\'s acceptance of this offer, failing which the earnest deposit shall be forfeited.\n4. The completion period shall be 90 days from the date of the SPA, with an automatic extension of 30 days subject to 8% p.a. late payment interest.\n\nSigned by Purchaser: ____________________\n\nVENDOR\'S ACCEPTANCE:\nI/We accept the above offer and confirm the appointment of [Law Firm Name] as my/our solicitors.\n\nSigned by Vendor: ____________________' 
          },
          {
            id: 'doc_1b',
            title: 'Stakeholder Receipt (Earnest Deposit)',
            type: 'template',
            content: 'OFFICIAL STAKEHOLDER RECEIPT\n\nNo: [Receipt No]\nDate: [Date]\n\nReceived from: [Purchaser Name]\nNRIC/Co. No: [Purchaser ID]\n\nThe sum of: Ringgit Malaysia [Amount in words] Only (RM [Amount])\n\nPayment via: [Cheque No / Online Transfer Ref]\n\nBeing: 2% Earnest Deposit towards the proposed purchase of [Property Address] from [Vendor Name].\n\nThis sum is held by us as stakeholders pending the execution of the Sale and Purchase Agreement.\n\nFor and on behalf of [Agency / Law Firm Name],\n\n____________________\nAuthorized Signatory'
          }
        ]
      },
      { 
        id: 2, 
        label: 'Execution of SPA & CKHT Forms',
        documents: [
          {
            id: 'doc_2a',
            title: 'Standard SPA (Schedule A / Sub-sale)',
            type: 'pdf_placeholder',
            content: '[Production Placeholder]\n\nIn a full production environment, this module will display the complete 30-page PDF of a standard Sub-sale SPA template including schedules for fittings and fixtures.'
          },
          {
            id: 'doc_2b',
            title: 'CKHT 2A Form (Purchaser)',
            type: 'pdf_placeholder',
            content: '[Production Placeholder]\n\nOfficial LHDN Form CKHT 2A (Acquisition of Real Property). Must be submitted within 60 days of the SPA date.'
          }
        ]
      },
      { 
        id: 3, 
        label: 'Stamping of SPA',
        documents: [
          {
            id: 'doc_3a',
            title: 'LHDN PDS 1 Form',
            type: 'pdf_placeholder',
            content: '[Production Placeholder]\n\nOfficial PDS 1 Form for stamping of the principal SPA document (usually stamped at RM10 per copy).'
          }
        ]
      },
      { 
        id: 4, 
        label: 'Presentation at Land Office (MOT)',
        documents: [
          {
            id: 'doc_4a',
            title: 'Form 14A (Memorandum of Transfer)',
            type: 'pdf_placeholder',
            content: '[Production Placeholder]\n\nNational Land Code Form 14A. Must be printed on A3 paper double-sided as per PTG regulations. Must be attested by a lawyer, notary public, or land administrator.'
          },
          {
            id: 'doc_4b',
            title: 'Covering Letter to Land Office',
            type: 'template',
            content: '[Law Firm Letterhead]\n\nDate: [Date]\n\nTo:\nPendaftar Hakmilik / Pentadbir Tanah\nPejabat Tanah dan Galian [State/District]\n\nDear Sir/Madam,\n\nPRESENTATION OF INSTRUMENT OF TRANSFER (FORM 14A)\nTitle No: [Title Details]\nLot/PT No: [Lot Details]\nMukim/Pekan/Bandar: [Mukim]\nDaerah: [District]\n\nWe enclose herewith the following documents for registration:\n1. Original Issue Document of Title (IDT)\n2. Form 14A duly executed and stamped\n3. Copy of Purchaser\'s NRIC\n4. Registration fee of RM[Amount] via Bank Draft No: [Number]\n\nPlease acknowledge receipt.\n\nYours faithfully,\n[Lawyer Name]\n[Firm Name]'
          }
        ]
      }
    ]
  },
  {
    id: 'flow_002',
    title: 'Purchase from Developer (Strata Title, Schedule H)',
    steps: [
      { 
        id: 1, 
        label: 'Payment of Booking Fee (Maximum RM500)',
        documents: []
      },
      { 
        id: 2, 
        label: 'Execution of Schedule H SPA',
        documents: [
          {
            id: 'doc_h_1',
            title: 'HDA Schedule H Agreement',
            type: 'pdf_placeholder',
            content: '[Production Placeholder]\n\nStandard statutory agreement under the Housing Development (Control and Licensing) Act 1966 for subdivided buildings (Strata).'
          }
        ]
      },
      { 
        id: 3, 
        label: 'Progressive Billings by Developer',
        documents: []
      },
      { 
        id: 4, 
        label: 'Delivery of Vacant Possession & Strata Title',
        documents: []
      }
    ]
  }
];
