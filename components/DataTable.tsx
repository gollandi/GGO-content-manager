"use client";

import { ReactNode } from "react";

interface DataTableProps {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export default function DataTable({
  title,
  subtitle,
  columns,
  loading = false,
  empty = false,
  emptyMessage = "No items found",
  children,
}: DataTableProps) {
  return (
    <div className="card data-table-card">
      <div className="data-table-header">
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        <button
          className="btn-pill opacity-50 cursor-not-allowed"
          disabled
          title="Coming soon"
        >
          Export
        </button>
      </div>
      <div className="data-table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "40px" }}>
                  Loading...
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
