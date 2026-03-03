import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@src/components/ui/button';

interface BackButtonProps {
  onGoBack: () => void;
  hidden?: boolean;
}

export function BackButton(props: BackButtonProps) {
  const { onGoBack, hidden = false } = props;

  useEffect(() => {
    if (hidden) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (
        (e.altKey && e.key === 'ArrowLeft') ||
        e.key === 'Backspace'
      ) {
        e.preventDefault();
        onGoBack();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGoBack, hidden]);

  if (hidden) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-8 shrink-0"
      onClick={onGoBack}
      aria-label="Go back"
      title="Go back (Alt+Left)"
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
