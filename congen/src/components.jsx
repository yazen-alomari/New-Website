import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, AlertCircle, Loader2 } from "lucide-react";

export function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={17} />
    </button>
  );
}
export function Button({ icon: Icon, children, kind = "", ...props }) {
  return (
    <button type="button" className={`button ${kind}`} {...props}>
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Badge({ children, tone = "" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Metric({ label, value, detail, accent }) {
  return (
    <div className={`metric ${accent || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      <Icon size={30} strokeWidth={1.4} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Alert({ children }) {
  return (
    <div className="alert" role="alert">
      <AlertCircle size={17} />
      <span>{children}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <Loader2 size={22} className="spin" />
      <span>Loading workspace</span>
    </div>
  );
}
export function Modal({ title, subtitle, children, close, wide = false }) {
  const ref = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const show = (event) => setError(event.detail);
    window.addEventListener("congen-error", show);
    return () => window.removeEventListener("congen-error", show);
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const cancel = (e) => {
      e.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-label={title}
    >
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton icon={X} label="Close dialog" onClick={close} />
      </header>
      <div className="modal-content">
        {error && <Alert>{error}</Alert>}
        {children}
      </div>
    </dialog>
  );
}
export function NumberField({
  label,
  value,
  change,
  cents = false,
  min = 0,
  max,
  step,
  hint,
  required = false,
}) {
  const formatted =
    value === null || value === undefined
      ? ""
      : String(cents ? value / 100 : value);
  const [text, setText] = useState(formatted);
  useEffect(() => setText(formatted), [formatted]);
  return (
    <Field label={label} hint={hint}>
      <div className="number-input">
        {cents && <span>$</span>}
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step ?? (cents ? "0.01" : "any")}
          value={text}
          placeholder="Not set"
          required={required}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            if (next === "") {
              if (!required) change(null);
              return;
            }
            const n = Number(next);
            if (
              Number.isFinite(n) &&
              n >= min &&
              (max === undefined || n <= max)
            )
              change(cents ? Math.round(n * 100) : n);
          }}
          onBlur={() => {
            if (required && text === "") setText(formatted);
          }}
        />
      </div>
    </Field>
  );
}
export function DownloadLink({ href, children }) {
  return (
    <a
      className="text-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}
export function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let s = String(value ?? "");
          if (/^[=+@\-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
