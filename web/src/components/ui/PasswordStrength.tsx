import { useTranslation } from 'react-i18next';

/** How many of the five policy rules the password meets (decision 22): length 8, upper, lower, digit, symbol. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  return [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
}

const COLORS = ['var(--risk-high)', 'var(--risk-high)', 'var(--risk-med)', 'var(--risk-med)', 'var(--risk-none)', 'var(--risk-none)'];

/** Five-segment strength bar with a text label (never colour alone). */
export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const score = passwordScore(password);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-sm" style={{ background: i < score ? COLORS[score] : 'var(--line)' }} />
        ))}
      </div>
      <div className="mt-1.5 text-xs text-ink-4" aria-live="polite">
        {password ? `${t('auth.strengthLabel')}: ${t(`auth.strength.${score}`)}` : t('auth.passwordRules')}
      </div>
    </div>
  );
}
