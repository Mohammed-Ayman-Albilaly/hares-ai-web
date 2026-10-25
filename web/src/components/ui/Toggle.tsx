interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/** Switch (role="switch"); `label` is its accessible name. In RTL the knob moves the other way. */
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
      className="relative shrink-0 rounded-full border-0 p-0 transition-colors disabled:opacity-50"
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
    </button>
  );
}
