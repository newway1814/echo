import type { ReactNode } from "react";
import { History, Home, UserRound } from "lucide-react";

export type ButtonTone = "dark" | "sage" | "muted";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return <div className="phone-shell">{children}</div>;
}

export function AppScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`screen ${className}`.trim()}>{children}</main>;
}

export function BreathingOrb({ kind = "record", label, disabled, onClick }: { kind?: "hero" | "record" | "recording"; label?: string; disabled?: boolean; onClick?: () => void }) {
  if (onClick || label) {
    return (
      <button className={`${kind === "hero" ? "hero-orb" : kind === "recording" ? "recording-orb" : "record-orb"}`} aria-label={label} disabled={disabled} onClick={onClick}>
        {kind === "record" ? <span className="record-icon" /> : null}
      </button>
    );
  }

  return <div className={kind === "hero" ? "hero-orb" : kind === "recording" ? "recording-orb" : "record-orb"} />;
}

export function EchoButton({ tone = "sage", children, disabled, onClick }: { tone?: ButtonTone; children: ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button className={`primary ${tone}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function PromptChip({ selected, children, onClick }: { selected?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button className={selected ? "selected" : ""} onClick={onClick}>
      {children}
    </button>
  );
}

export function SoftCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`soft-card ${className}`.trim()}>{children}</div>;
}

export function SectionLabel({ tone = "sage", children }: { tone?: "sage" | "clay"; children: ReactNode }) {
  return <p className={`section-label ${tone === "clay" ? "clay" : "sage-text"}`}>{children}</p>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="echo-tag">{children}</span>;
}

export function ReflectionText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`reflection-text ${className}`.trim()}>{children}</p>;
}

export function BottomNav({ active, onToday, onHistory }: { active: "today" | "history"; onToday: () => void; onHistory: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button className={active === "today" ? "active" : ""} onClick={onToday}>
        <Home size={16} />
        Today
      </button>
      <button className={active === "history" ? "active" : ""} onClick={onHistory}>
        <History size={16} />
        Reflections
      </button>
      <button>
        <UserRound size={16} />
        You
      </button>
    </nav>
  );
}



