type Tone = "success" | "info" | "warning" | "danger" | "secondary";

interface StatusBadgeProps {
  tone: Tone;
  label: string;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  success: "status-badge-success",
  info: "status-badge-info",
  warning: "status-badge-warning",
  danger: "status-badge-danger",
  secondary: "status-badge-secondary",
};

export default function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${toneClasses[tone]} ${className ?? ""}`}>
      {label}
    </span>
  );
}

/**
 * Derive a tone from a ContentItem status string.
 * Centralises the logic that was duplicated across pages.
 */
export function getStatusTone(status: string): Tone {
  if (status.includes("Live")) return "success";
  if (status.includes("Review")) return "info";
  if (status.includes("Update") || status.includes("Draft")) return "warning";
  if (status.includes("Archived")) return "danger";
  return "secondary";
}
