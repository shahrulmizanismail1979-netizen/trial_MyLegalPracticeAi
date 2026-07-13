import React from 'react';
import { X, FileText, PenTool, Copy, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { hasTier, requiredTierForTool, TIER_LABELS } from '@/lib/tier';

export function DocumentModal() {
  const { selectedDocument, setSelectedDocument, openDrafterWithDoc, currentUser } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const canDraft =
    !!currentUser?.grandfathered || hasTier(currentUser?.tier, requiredTierForTool('drafter'));

  const handleCopy = () => {
    if (selectedDocument?.content) {
      navigator.clipboard.writeText(selectedDocument.content)
        .then(() => {
          toast({
            title: "Copied to clipboard",
            description: `${selectedDocument.title} has been copied.`,
          });
        })
        .catch((err) => {
          console.error("Failed to copy", err);
          toast({
            variant: "destructive",
            title: "Copy failed",
            description: "Please select the text manually.",
          });
        });
    }
  };

  return (
    <AnimatePresence>
      {selectedDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDocument(null)}
            className="absolute inset-0 bg-gold-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-gold-900 border border-gold-700 rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gold-800 bg-gold-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-lg text-slate-100">{selectedDocument.title}</h3>
                  <p className="text-xs text-slate-400 capitalize tracking-wider">
                    {selectedDocument.type === 'template' ? 'Editable Template' : 'Official Form PDF'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDocument(null)}
                className="p-2 text-slate-400 hover:text-slate-100 hover:bg-gold-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gold-950/50">
              {selectedDocument.type === 'template' ? (
                <div className="relative group">
                  <pre className="whitespace-pre-wrap font-serif text-sm text-slate-300 leading-relaxed bg-gold-900 p-6 rounded-xl border border-gold-800">
                    {selectedDocument.content}
                  </pre>
                  <button 
                    onClick={handleCopy}
                    className="absolute top-4 right-4 p-2 bg-gold-800 hover:bg-gold-700 text-slate-300 rounded-md opacity-0 group-hover:opacity-100 transition-all border border-gold-700 shadow-lg"
                    title="Copy text"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-gold-800 rounded-xl bg-gold-900/30">
                  <div className="w-20 h-20 bg-gold-800 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10 text-slate-500" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-200 mb-2">Production PDF Viewer</h4>
                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    {selectedDocument.content}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gold-800 bg-gold-900 flex justify-end gap-3">
              <button
                onClick={() => setSelectedDocument(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-gold-800 hover:bg-gold-700 rounded-xl transition-colors border border-gold-700"
              >
                Close
              </button>
              {canDraft ? (
                <button
                  onClick={() => openDrafterWithDoc(selectedDocument.title)}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
                >
                  <PenTool className="w-4 h-4" />
                  Modify with AI Drafter
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedDocument(null);
                    navigate('/pricing');
                  }}
                  title={`AI Drafter requires the ${TIER_LABELS[requiredTierForTool('drafter')]} plan`}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-amber-300 bg-gold-800 hover:bg-gold-700 rounded-xl transition-colors border border-amber-500/30"
                >
                  <Lock className="w-4 h-4" />
                  Unlock AI Drafter
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
