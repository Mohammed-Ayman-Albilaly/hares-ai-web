import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

/**
 * Announces the new page to screen readers after a client-side navigation.
 * A single-page app does not reload the document, so without this a screen
 * reader user gets no feedback that the page changed (WCAG 2.4.3 / 4.1.3,
 * rule-navigational.md / Route changes).
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const first = useRef(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // The first load is already announced by the document title; only changes matter.
    if (first.current) {
      first.current = false;
      return;
    }
    // Each screen sets document.title in its own effect: wait for that to run.
    const id = window.setTimeout(() => setMessage(document.title || t('app.loading')), 120);
    return () => window.clearTimeout(id);
  }, [pathname, t]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
