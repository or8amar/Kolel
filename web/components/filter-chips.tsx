"use client";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface FilterChipsProps<T extends string> {
  value: T;
  options: FilterChipOption<T>[];
  onChange: (value: T) => void;
}

export function FilterChips<T extends string>({ value, options, onChange }: FilterChipsProps<T>) {
  return (
    <div className="filter-bar" role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`filter-chip ${active ? "active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon ? <span aria-hidden>{opt.icon} </span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
