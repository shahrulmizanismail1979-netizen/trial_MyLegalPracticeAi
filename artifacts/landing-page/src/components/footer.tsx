export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card py-12 px-6 lg:px-8 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <p className="font-serif text-xl font-bold text-foreground mb-2">
            AI Portals
          </p>
          <p className="text-sm text-muted-foreground">
            by Shahrul Mizan
          </p>
        </div>
        
        <div className="text-center md:text-right text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AI Portals. All rights reserved.</p>
          <p className="mt-1">Malaysia's First AI-Enhanced Legal Reference Platform</p>
        </div>
      </div>
    </footer>
  );
}