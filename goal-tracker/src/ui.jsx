import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { X, AlertCircle, Download } from "./icons.js";
import {
  teams,
  teamById,
  dateLabel,
  currentProgress,
  etaLabel,
  timestamp,
  orderedUpdates,
  wavePath,
  phases,
} from "./model.js";
export function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={17} />
    </button>
  );
}
export function Button({ icon: Icon, children, primary = false, ...props }) {
  return (
    <button
      type="button"
      className={`button ${primary ? "primary" : ""}`}
      {...props}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
export function Field({ label, children, hint }) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {cloneElement(children, { "aria-labelledby": labelId })}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TeamBadge({ id, name, small = false }) {
  const team = teamById(id);
  return (
    <span className={`team-badge ${id || "none"} ${small ? "small" : ""}`}>
      <i />
      {name || team?.name || (id === "source" ? "Source import" : "Unassigned")}
    </span>
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
export function Modal({ title, close, children, drawer = false }) {
  const ref = useRef();
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
      className={drawer ? "drawer" : "modal"}
      ref={ref}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <IconButton icon={X} label="Close dialog" onClick={close} />
      </div>
      {children}
    </dialog>
  );
}
export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function exportSnapshot(data) {
  const goals = data.goals.filter((g) => !g.archived);
  const cards = goals
    .map((g) => {
      const p = currentProgress(g);
      return `<article><header><div><small>${escape(g.account)} / ${escape(g.scope)}</small><h2>${escape(g.title)}</h2></div><strong>${p === null ? "Progress not set" : p + "%"}</strong></header><p><b>Goal:</b> ${escape(g.outcome)}</p><p><b>Status:</b> ${escape(g.status)}</p><p><b>Target:</b> ${escape(etaLabel(g))} &nbsp; <b>Owner:</b> ${escape(teamById(g.team)?.name || "Unassigned")}</p><svg viewBox="0 0 720 64" aria-label="${p ?? "Unset"} percent"><path d="${wavePath(8, 712, 32, 7)}" fill="none" stroke="#e0e7e1" stroke-width="3"/><path d="${wavePath(8, 8 + (704 * (p || 0)) / 100, 32, 7)}" fill="none" stroke="#349c61" stroke-width="3"/></svg><details open><summary>${g.updates.length} embedded updates</summary>${orderedUpdates(
        g,
      )
        .reverse()
        .map(
          (u) =>
            `<section><small>${escape(dateLabel(u.date, true))} / ${escape(teamById(u.actor.team)?.name || "Source import")}${u.actor.name && u.actor.team !== "source" ? " / " + escape(u.actor.name) : ""} / ${u.progress === null ? "Unscored" : u.progress + "%"}</small><p>${escape(u.note)}</p>${u.editedAt ? `<small>Edited by ${escape(teamById(u.editor?.team)?.name || "Team")} / ${escape(timestamp(u.editedAt))}</small>` : ""}</section>`,
        )
        .join("")}</details></article>`;
    })
    .join("");
  const history = data.history
    .map(
      (e) =>
        `<section><small>${escape(timestamp(e.at))} / ${escape(teamById(e.actor.team)?.name)} ${escape(e.actor.name)}</small><p>${escape(e.goalTitle)}: ${escape(e.summary)}</p><details><summary>Preserved change record</summary><pre>${escape(JSON.stringify({ before: e.before, after: e.after }, null, 2))}</pre></details></section>`,
    )
    .join("");
  download(
    `TrueMed-LIS-snapshot-${new Date().toISOString().slice(0, 10)}.html`,
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>TrueMed LIS Tracker - Snapshot</title><style>body{font:14px/1.6 system-ui,sans-serif;background:#f6f8f6;color:#25332c;margin:0}main{max-width:1000px;margin:auto;padding:36px 22px}h1{font-size:30px}h2{font-size:20px;margin:5px 0}article{background:white;border:1px solid #dce5df;border-radius:6px;padding:24px;margin:22px 0}header{display:flex;justify-content:space-between;gap:20px}small{color:#68786e}strong{color:#278852}section{padding:15px 0;border-top:1px solid #e3e9e5}p{white-space:pre-wrap;overflow-wrap:anywhere}svg{width:100%;height:64px}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}footer{margin:32px 0;color:#718278}@media print{article{break-inside:avoid}body{background:white}}</style><main><small>ALOMARI ASSOCIATES / SHARED WORKSTREAMS</small><h1>TrueMed LIS tracker</h1><p>Read-only snapshot / ${escape(new Date().toLocaleString())}</p>${cards}<h2>Edit history</h2>${history || "<p>No edits after import.</p>"}<footer>Snapshot only. New changes are saved in the shared workspace, not this exported file.</footer></main></html>`,
    "text/html;charset=utf-8",
  );
}
