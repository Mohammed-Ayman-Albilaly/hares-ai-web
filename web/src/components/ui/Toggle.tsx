interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Switch (role="switch"); `label` is its accessible name. In RTL the knob moves
 * the other way. The visible track stays compact, but the button itself is
 * 44x44 so it meets the WCAG 2.5.8 target size (rule-actions-components.md /
 * Touch targets).
 */
export function Toggle({ checked, onChange, label, disabled, size = 'md' }: Props) {
  const w = size === 'sm' ? 32 : 38;
  const h = size === 'sm' ? 18 : 22;
  const k = size === 'sm' ? 14 : 18;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid shrink-0 place-items-center rounded-full border-0 bg-transparent p-0 disabled:opacity-50"
      style={{ width: 'var(--target-min)', height: 'var(--target-min)' }}
    >
      <span
        aria-hidden="true"
        className="relative block rounded-full transition-colors"
        style={{ width: w, height: h, background: checked ? 'var(--accent)' : 'var(--control-line)' }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-all"
          style={{
            width: k,
            height: k,
            insetInlineStart: checked ? w - k - 2 : 2,
            boxShadow: '0 1px 3px rgb(0 0 0 / 0.18)',
          }}
        />
      </span>
    </button>
  );
}
