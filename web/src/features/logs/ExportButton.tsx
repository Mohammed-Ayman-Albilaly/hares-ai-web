import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import type { LogFilterValues } from './hooks';

/**
 * CSV export of the current filters (WEB-FR-025). The file is built by the
 * server (metadata only, formula-safe) and saved from here with the signed-in
 * token, so nothing is exposed in a URL.
 */
export function ExportButton({ path, filters }: { path: string; filters: LogFilterValues }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
      const { blob, filename } = await api.download(`${path}?${p.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Not at once: some browsers cancel a download whose URL is revoked before it starts.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(apiErrorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={() => void run()} loading={busy} loadingLabel={t('logs.exporting')}>
        <I.Download size={14} /> {t('logs.export')}
      </Button>
      {error && (
        <div className="err" role="alert">
          {t('logs.exportFailed')} {error}
        </div>
      )}
    </div>
  );
}
