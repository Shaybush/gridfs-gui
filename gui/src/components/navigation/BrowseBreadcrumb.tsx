import { ChevronRight, Home } from 'lucide-react';
import type { Breadcrumb, BrowseLevel } from '@src/hooks/useBrowseNavigation';

interface BrowseBreadcrumbProps {
  breadcrumbs: Breadcrumb[];
  onNavigate: (level: BrowseLevel, value?: string) => void;
}

function CrumbLabel({ label, isHome }: { label: string; isHome: boolean }) {
  return (
    <>
      {isHome && <Home className="inline size-3.5 mr-1 -mt-0.5" />}
      {label}
    </>
  );
}

export function BrowseBreadcrumb(props: BrowseBreadcrumbProps) {
  const { breadcrumbs, onNavigate } = props;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isHome = index === 0;

        return (
          <div key={crumb.level} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            )}

            {isLast ? (
              <span
                className="truncate font-medium text-foreground max-w-[160px]"
                title={crumb.label}
              >
                <CrumbLabel label={crumb.label} isHome={isHome} />
              </span>
            ) : (
              <button
                type="button"
                className="truncate text-muted-foreground hover:text-foreground transition-colors max-w-[120px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm px-0.5"
                title={crumb.label}
                onClick={() => onNavigate(crumb.level, crumb.value ?? undefined)}
              >
                <CrumbLabel label={crumb.label} isHome={isHome} />
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
