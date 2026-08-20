export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card py-12 px-6 lg:px-8 mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <img
              src={`${import.meta.env.BASE_URL}lawyes-logo.png`}
              alt="LAWYes"
              className="h-24 w-auto mb-3"
            />
            <p className="text-sm text-muted-foreground mb-1">
              by Prof. Madya Dr. Shahrul Mizan Ismail
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your Legal Work, Solved. — Malaysia's AI-powered virtual paralegal suite.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="flex flex-col sm:flex-row gap-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</p>
              <ul className="space-y-2">
                <li>
                  <a href="#apps" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    AI Portals
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#payment" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    How to Subscribe
                  </a>
                </li>
                <li>
                  <a href="/manage-subscription" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Manage or Cancel Subscription
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</p>
              <ul className="space-y-2">
                <li>
                  <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/60139725475"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a href="mailto:shahrulmizan@ukm.edu.my" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</p>
              <ul className="space-y-2">
                <li>
                  <a href="#terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} LAWYes by Shahrul Mizan Ismail. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Malaysia's First AI-Powered Virtual Paralegal
          </p>
        </div>
      </div>
    </footer>
  );
}
