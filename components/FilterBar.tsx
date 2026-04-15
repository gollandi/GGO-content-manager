"use client";

interface FilterBarProps<T extends string> {
  filters: T[];
  active: T;
  onChange: (filter: T) => void;
  className?: string;
}

export default function FilterBar<T extends string>({
  filters,
  active,
  onChange,
  className,
}: FilterBarProps<T>) {
  return (
    <div className={`filter-row ${className ?? ""}`}>
      {filters.map((filter) => (
        <button
          key={filter}
          className={active === filter ? "filter-pill filter-active" : "filter-pill"}
          onClick={() => onChange(filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
