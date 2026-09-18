/** 共通コンポーネント（デザインガイドライン §6） */
import { useEffect, useRef, type ReactNode } from 'react';

/* ---------- ダイアログ ---------- */
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog fade-in" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <h2 className="dialog__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ---------- 空状態 ---------- */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{message}</p>
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

/* ---------- セグメント ---------- */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="segment" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="segment__item"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- テキスト入力 ---------- */
export function TextField({
  label,
  value,
  onChange,
  optional,
  placeholder,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {optional && <span className="field__optional">（任意）</span>}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" role="alert">
          ⚠ {error}
        </p>
      )}
    </label>
  );
}

export function DateField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  optional?: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {optional && <span className="field__optional">（任意）</span>}
      </span>
      <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    </label>
  );
}

/* ---------- 数値入力（不明トグル付き） ---------- */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  optional,
  allowUnknown,
  integer,
  error,
  warning,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  optional?: boolean;
  /** 不明・未計測トグルを表示するか */
  allowUnknown?: boolean;
  integer?: boolean;
  error?: string;
  warning?: string;
  hint?: string;
}) {
  const isUnknown = value === null;
  return (
    <div className="field">
      <span className="field__label">
        {label} {optional && <span className="field__optional">（任意）</span>}
      </span>
      <div className="field__control">
        <input
          type="number"
          inputMode={integer ? 'numeric' : 'decimal'}
          value={value ?? ''}
          disabled={allowUnknown && isUnknown}
          aria-label={label}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(null);
              return;
            }
            const n = Number(raw);
            onChange(Number.isNaN(n) ? null : n);
          }}
        />
        {unit && <span className="field__unit">{unit}</span>}
        {allowUnknown && (
          <label className="unknown-toggle">
            <input
              type="checkbox"
              checked={isUnknown}
              onChange={(e) => onChange(e.target.checked ? null : 0)}
            />
            不明
          </label>
        )}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" role="alert">
          ⚠ {error}
        </p>
      )}
      {!error && warning && <p className="field__warning">⚠ {warning}</p>}
    </div>
  );
}

/* ---------- 時間入力（分・秒、未計測トグル付き） ---------- */
export function TimeField({
  label,
  valueSec,
  onChange,
  hint,
  error,
  warning,
}: {
  label: string;
  valueSec: number | null;
  onChange: (v: number | null) => void;
  hint?: string;
  error?: string;
  warning?: string;
}) {
  const isUnknown = valueSec === null;
  const min = valueSec === null ? '' : Math.floor(valueSec / 60);
  const sec = valueSec === null ? '' : valueSec % 60;

  const update = (m: string, s: string) => {
    if (m === '' && s === '') {
      onChange(null);
      return;
    }
    const mm = m === '' ? 0 : Number(m);
    const ss = s === '' ? 0 : Number(s);
    if (Number.isNaN(mm) || Number.isNaN(ss)) return;
    onChange(Math.trunc(mm) * 60 + Math.trunc(ss));
  };

  return (
    <div className="field">
      <span className="field__label">
        {label} <span className="field__optional">（任意）</span>
      </span>
      <div className="field__control">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={min}
          disabled={isUnknown}
          aria-label={`${label}（分）`}
          onChange={(e) => update(e.target.value, String(sec))}
        />
        <span className="field__unit">分</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={sec}
          disabled={isUnknown}
          aria-label={`${label}（秒）`}
          onChange={(e) => update(String(min), e.target.value)}
        />
        <span className="field__unit">秒</span>
        <label className="unknown-toggle">
          <input
            type="checkbox"
            checked={isUnknown}
            onChange={(e) => onChange(e.target.checked ? null : 0)}
          />
          未計測
        </label>
      </div>
      {hint && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" role="alert">
          ⚠ {error}
        </p>
      )}
      {!error && warning && <p className="field__warning">⚠ {warning}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  optional,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {optional && <span className="field__optional">（任意）</span>}
      </span>
      <textarea
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
