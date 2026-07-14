import { useState } from 'react';
import { useListTerms } from '@/hooks/use-terminology';
import { PageHeader, Card, CardContent, Badge, Input } from '@/components/ui';
import { Search, BookA, Quote } from 'lucide-react';

export default function Terminology() {
  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState<string>('');
  
  const { data: terms, isLoading } = useListTerms({ search: search || undefined, letter: letter || undefined });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader 
        title="Legal Concepts" 
        description="Definitions, Latin maxims, and judicial interpretations of key Malaysian litigation legal terms across all practice areas."
      />

      <div className="mb-8 space-y-6">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search glossary..." 
            className="pl-12 h-14 text-lg rounded-xl bg-card shadow-sm border-border focus-visible:ring-primary/50"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-1">
          <button 
            className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold transition-colors ${letter === '' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-secondary border border-border'}`}
            onClick={() => setLetter('')}
          >
            All
          </button>
          {alphabet.map(l => (
            <button 
              key={l}
              className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold transition-colors ${letter === l ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-secondary border border-border'}`}
              onClick={() => setLetter(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading Glossary...</div>
      ) : (
        <div className="space-y-4">
          {terms?.map((term: any) => (
            <Card key={term.id} className="hover:border-primary/30 transition-colors border-border/50">
              <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row gap-6">
                <div className="md:w-1/3">
                  <h3 className="font-serif text-2xl font-bold text-primary mb-2 flex items-center gap-2">
                    {term.term}
                  </h3>
                  {term.latinOrigin && (
                    <p className="text-sm italic text-muted-foreground mb-3 font-serif">
                      Latin: {term.latinOrigin}
                    </p>
                  )}
                  <Badge variant="secondary" className="mb-2">{term.category}</Badge>
                </div>
                
                <div className="md:w-2/3 space-y-4">
                  <div className="bg-background rounded-lg p-4 border border-border shadow-inner text-foreground leading-relaxed">
                    {term.definition}
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {term.example && (
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Quote className="h-3 w-3"/> Context/Example</h5>
                        <p className="text-sm text-foreground/80 italic">{term.example}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><BookA className="h-3 w-3"/> Authority</h5>
                      <p className="text-sm font-mono text-primary/80">{term.source}</p>
                    </div>
                  </div>

                  {term.relatedTerms.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2 items-center text-sm">
                      <span className="text-muted-foreground">See also:</span>
                      {term.relatedTerms.map((rt: any) => (
                        <span key={rt} className="text-primary hover:underline cursor-pointer">{rt}</span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {terms?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground bg-card border border-dashed border-border rounded-xl">
              <p className="text-lg">No terms found matching your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
