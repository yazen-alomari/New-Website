import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Download,
  FileText,
  Link2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
  X,
  Pause,
  Play,
  Archive,
  CalendarDays,
  LayoutList,
  Columns3,
  Upload,
} from "lucide-react";
import { dayLabel, isoDay, progress, stages, tasksFor } from "./model.js";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Field,
  IconButton,
  Metric,
  Modal,
  csv,
  download,
} from "./components.jsx";
import { base, request } from "./api.js";

export function ClientForm({ client, close, save, busy, actor }) {
  const [type, setType] = useState(client?.type || "lab");
  const fields = [
    ["name", "Organization name", true],
    ["contact", "Primary contact", true],
    ["rep", "Introducing representative", true],
    ["owner", "Onboarding owner", false],
    ["email", "Contact email", false, "email"],
    ["phone", "Phone", false, "tel"],
    ["city", "City / service area"],
    ["tests", "Requested test panels"],
    ["volume", "Expected monthly volume"],
    ["dueDate", "Target go-live date", false, "date"],
    ["nextAction", "Next action"],
    ["lisId", "LIS / account reference"],
  ];
  return (
    <Modal
      wide
      title={client ? "Edit client" : "Introduce a client"}
      subtitle="Referring laboratory or clinic"
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const value = Object.fromEntries(new FormData(e.currentTarget));
          if (
            await save({
              type: "client.save",
              value: { ...value, type, id: client?.id },
            })
          )
            close();
        }}
      >
        <div className="type-selector">
          {[
            ["lab", Building2, "Referring laboratory"],
            ["clinic", Stethoscope, "Clinic / practice"],
          ].map(([value, Icon, label]) => (
            <button
              type="button"
              disabled={Boolean(client)}
              className={type === value ? "active" : ""}
              key={value}
              onClick={() => setType(value)}
              aria-pressed={type === value}
            >
              <Icon size={21} />
              <span>{label}</span>
              {type === value && <Check size={16} />}
            </button>
          ))}
        </div>
        <div className="field-grid">
          {fields.map(([name, label, required, inputType]) => (
            <Field key={name} label={label + (required ? " *" : "")}>
              <input
                name={name}
                type={inputType || "text"}
                required={required}
                maxLength={
                  name === "email" ? 254 : name === "nextAction" ? 300 : 120
                }
                defaultValue={client?.[name] || (name === "owner" ? actor : "")}
              />
            </Field>
          ))}
        </div>
        <Field label="Shipping / courier notes">
          <textarea
            name="shipping"
            rows={3}
            maxLength={500}
            defaultValue={client?.shipping || ""}
          />
        </Field>
        <footer className="form-actions">
          <Button onClick={close}>Cancel</Button>
          <button className="button primary" disabled={busy}>
            <Plus size={16} />
            {client ? "Save client" : "Add client"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export default function Clients({
  data,
  save,
  busy,
  actor,
  notify,
  clientId,
  navigate,
  onData,
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [layout, setLayout] = useState("list"),
    [modal, setModal] = useState(null),
    [stage, setStage] = useState(null),
    [detailTab, setDetailTab] = useState("timeline"),
    [note, setNote] = useState(""),
    [uploading, setUploading] = useState(false);
  const client = data.clients.find((c) => c.id === clientId);
  const active = data.clients.filter((c) => !c.archived);
  const filtered = data.clients
    .filter((c) => (filter === "archived" ? c.archived : !c.archived))
    .filter(
      (c) =>
        ((filter !== "lab" && filter !== "clinic") || c.type === filter) &&
        (filter !== "hold" || c.hold) &&
        (filter !== "active" || progress(c).active) &&
        (filter !== "overdue" ||
          (c.dueDate && c.dueDate < isoDay() && !progress(c).active)),
    )
    .filter((c) =>
      `${c.name} ${c.contact} ${c.rep} ${c.owner} ${c.city}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const p = client && progress(client);
  const selectedStage =
    stages.find((s) => s.id === (stage || p?.stage)) || stages[0];
  function open(c) {
    setStage(null);
    setDetailTab("timeline");
    navigate(`clients/${c.id}`);
  }
  const status = (c) =>
    c.archived ? (
      <Badge>Archived</Badge>
    ) : c.hold ? (
      <Badge tone="amber">On hold</Badge>
    ) : progress(c).active ? (
      <Badge tone="green">Active</Badge>
    ) : (
      <Badge tone="blue">{stages[progress(c).index].short}</Badge>
    );
  const exportClients = () =>
    download(
      `congen-onboarding-${isoDay()}.csv`,
      csv([
        [
          "Organization",
          "Type",
          "Contact",
          "Email",
          "Phone",
          "Representative",
          "Owner",
          "Stage",
          "Complete %",
          "Target go-live",
          "Next action",
        ],
        ...filtered.map((c) => [
          c.name,
          c.type,
          c.contact,
          c.email,
          c.phone,
          c.rep,
          c.owner,
          c.hold ? "On hold" : stages[progress(c).index].name,
          progress(c).percent,
          c.dueDate,
          c.nextAction,
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  async function uploadDocument(file, category, name) {
    if (!file || uploading) return false;
    if (file.size > 2000000) {
      window.dispatchEvent(
        new CustomEvent("congen-error", {
          detail: "Choose a file smaller than 2 MB.",
        }),
      );
      return false;
    }
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      for (let i = 0; i < bytes.length; i += 8192)
        raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const saved = await request("files", {
        method: "POST",
        body: JSON.stringify({
          clientId: client.id,
          category,
          name: name || file.name,
          filename: file.name,
          mime: file.type,
          content: btoa(raw),
          revision: data.revision,
        }),
      });
      onData(saved);
      notify("Document saved");
      return true;
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("congen-error", { detail: e.message }),
      );
      return false;
    } finally {
      setUploading(false);
    }
  }
  return (
    <div>
      {!client ? (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">RELATIONSHIPS TO READINESS</span>
              <h1>
                Client onboarding
                <span className="title-dot blue" />
              </h1>
              <p>
                Every introduction. Every milestone. One clear path to go-live.
              </p>
            </div>
            <div className="actions">
              <IconButton
                icon={Download}
                label="Export client list"
                onClick={exportClients}
              />
              <Button
                icon={Plus}
                kind="primary"
                onClick={() => setModal("create")}
              >
                Introduce client
              </Button>
            </div>
          </div>
          <div className="metrics">
            <Metric
              label="In progress"
              value={
                active.filter((c) => !progress(c).active && !c.hold).length
              }
              detail="Moving through onboarding"
            />
            <Metric
              label="Awaiting documents"
              value={
                active.filter((c) => progress(c).stage === "documents").length
              }
              detail="Agreements & profiles"
            />
            <Metric
              label="Needs attention"
              value={
                active.filter(
                  (c) =>
                    c.hold ||
                    (c.dueDate && c.dueDate < isoDay() && !progress(c).active),
                ).length
              }
              detail="On hold or past target"
              accent="amber"
            />
            <Metric
              label="Live accounts"
              value={active.filter((c) => progress(c).active).length}
              detail="All milestones completed"
              accent="green"
            />
          </div>
          <div className="list-toolbar">
            <div className="search">
              <Search size={17} />
              <input
                aria-label="Search clients"
                placeholder="Search clients, reps or owners"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter clients"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {[
                ["all", "All clients"],
                ["lab", "Referring labs"],
                ["clinic", "Clinics"],
                ["hold", "On hold"],
                ["overdue", "Past target"],
                ["active", "Active"],
                ["archived", "Archived"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <div className="segmented icon-segment">
              <IconButton
                icon={LayoutList}
                label="List view"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
              />
              <IconButton
                icon={Columns3}
                label="Pipeline view"
                aria-pressed={layout === "board"}
                onClick={() => setLayout("board")}
              />
            </div>
          </div>
          {!filtered.length ? (
            <Empty
              icon={Users}
              title={
                active.length
                  ? "No matching clients"
                  : "Your next partnership starts here"
              }
              action={
                <Button icon={Plus} onClick={() => setModal("create")}>
                  Introduce client
                </Button>
              }
            >
              {active.length
                ? "Change the search or filters."
                : "No organizations have been introduced yet."}
            </Empty>
          ) : layout === "list" ? (
            <div className="table-scroll client-table">
              <table>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Owner / representative</th>
                    <th>Current stage</th>
                    <th>Progress</th>
                    <th>Target go-live</th>
                    <th>Next action</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button className="client-name" onClick={() => open(c)}>
                          <span className={`client-icon ${c.type}`}>
                            {c.type === "lab" ? (
                              <Building2 size={18} />
                            ) : (
                              <Stethoscope size={18} />
                            )}
                          </span>
                          <span>
                            <b>{c.name}</b>
                            <small>
                              {c.type === "lab"
                                ? "Referring laboratory"
                                : "Clinic"}
                              {c.city && ` / ${c.city}`}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <b>{c.owner || "Unassigned"}</b>
                        <small>Rep: {c.rep}</small>
                      </td>
                      <td>{status(c)}</td>
                      <td>
                        <div className="progress-inline">
                          <div className="progress-track">
                            <i style={{ width: `${progress(c).percent}%` }} />
                          </div>
                          <b>{progress(c).percent}%</b>
                        </div>
                      </td>
                      <td
                        className={
                          c.dueDate &&
                          c.dueDate < isoDay() &&
                          !progress(c).active
                            ? "text-amber"
                            : ""
                        }
                      >
                        {dayLabel(c.dueDate)}
                      </td>
                      <td className="next-action">
                        {c.nextAction || "Not assigned"}
                      </td>
                      <td>
                        <IconButton
                          icon={ArrowUpRight}
                          label={`Open ${c.name}`}
                          onClick={() => open(c)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="pipeline-board">
              {stages.map((s) => (
                <section key={s.id}>
                  <header>
                    <span>{s.short}</span>
                    <b>
                      {
                        filtered.filter((c) => progress(c).stage === s.id)
                          .length
                      }
                    </b>
                  </header>
                  {filtered
                    .filter((c) => progress(c).stage === s.id)
                    .map((c) => (
                      <button
                        className="pipeline-client"
                        key={c.id}
                        onClick={() => open(c)}
                      >
                        <Badge>{c.type === "lab" ? "Lab" : "Clinic"}</Badge>
                        <h3>{c.name}</h3>
                        <p>{c.nextAction || c.contact}</p>
                        <div className="progress-track">
                          <i style={{ width: `${progress(c).percent}%` }} />
                        </div>
                        <footer>
                          <span>{c.owner || c.rep}</span>
                          <span>{dayLabel(c.dueDate)}</span>
                        </footer>
                      </button>
                    ))}
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button className="back-link" onClick={() => navigate("clients")}>
            <ArrowLeft size={16} />
            All clients
          </button>
          <div className="page-heading detail-heading">
            <div>
              <span className="eyebrow">
                {client.type === "lab"
                  ? "REFERRING LABORATORY"
                  : "CLINIC / PRACTICE"}
              </span>
              <h1>{client.name}</h1>
              <div className="detail-meta">
                {status(client)}
                <span>{client.city || "Location not entered"}</span>
                <span>Introduced {dayLabel(client.createdAt)}</span>
              </div>
            </div>
            <div className="actions">
              <IconButton
                icon={Archive}
                label={client.archived ? "Restore client" : "Archive client"}
                onClick={async () => {
                  if (
                    window.confirm(
                      `${client.archived ? "Restore" : "Archive"} ${client.name}?`,
                    )
                  )
                    await save({ type: "client.archive", id: client.id });
                }}
              />
              <Button
                icon={client.hold ? Play : Pause}
                onClick={() =>
                  client.hold
                    ? save({ type: "client.hold", id: client.id, hold: false })
                    : setModal("hold")
                }
              >
                {client.hold ? "Resume" : "Hold"}
              </Button>
              <Button icon={Pencil} onClick={() => setModal("edit")}>
                Edit details
              </Button>
            </div>
          </div>
          <div className="client-summary">
            <div>
              <span>ONBOARDING OWNER</span>
              <strong>{client.owner || "Unassigned"}</strong>
              <small>Rep: {client.rep}</small>
            </div>
            <div>
              <span>TARGET GO-LIVE</span>
              <strong>{dayLabel(client.dueDate)}</strong>
              <small>
                {p.active
                  ? "Onboarding complete"
                  : `${p.total - p.complete} milestones remaining`}
              </small>
            </div>
            <div className="wide">
              <span>NEXT ACTION</span>
              <strong>{client.nextAction || "Not assigned"}</strong>
              <small>{client.tests || "Test menu not entered"}</small>
            </div>
            <div className="completion-number">
              <strong>
                {p.percent}
                <small>%</small>
              </strong>
              <div className="progress-track">
                <i style={{ width: `${p.percent}%` }} />
              </div>
            </div>
          </div>
          {client.hold && (
            <Alert>
              This account is on hold. Resume onboarding to complete milestones.
            </Alert>
          )}
          <nav className="detail-tabs">
            {[
              ["timeline", "Onboarding timeline"],
              ["documents", "Documents", client.documents.length],
              ["notes", "Notes", client.notes.length],
              ["activity", "Activity", client.events.length],
            ].map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setDetailTab(key)}
                aria-current={detailTab === key ? "page" : undefined}
              >
                {label}
                {count !== undefined && <span>{count}</span>}
              </button>
            ))}
          </nav>
          <div className="client-detail-grid">
            <div>
              {detailTab === "timeline" && (
                <>
                  <div className="timeline-stages">
                    {stages.map((s, i) => {
                      const all = tasksFor(client.type, s.id),
                        done = all.filter(
                          ([id]) => client.tasks[`${s.id}.${id}`]?.done,
                        ).length;
                      return (
                        <button
                          key={s.id}
                          className={`${selectedStage.id === s.id ? "selected" : ""} ${done === all.length ? "done" : ""}`}
                          onClick={() => setStage(s.id)}
                        >
                          <div className="stage-node">
                            {done === all.length ? (
                              <Check size={17} />
                            ) : (
                              <span>{String(i + 1).padStart(2, "0")}</span>
                            )}
                          </div>
                          <span>
                            <b>{s.name}</b>
                            <small>
                              {done} / {all.length} milestones
                            </small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      );
                    })}
                  </div>
                  <section className="milestone-section">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          STAGE {stages.indexOf(selectedStage) + 1} OF 7
                        </span>
                        <h2>{selectedStage.name}</h2>
                      </div>
                      <Badge tone="blue">
                        {client.type === "lab"
                          ? "Laboratory pathway"
                          : "Clinic pathway"}
                      </Badge>
                    </div>
                    {tasksFor(client.type, selectedStage.id).map(
                      ([id, label]) => {
                        const value = client.tasks[`${selectedStage.id}.${id}`];
                        return (
                          <label
                            className={`milestone ${value?.done ? "completed" : ""}`}
                            key={id}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(value?.done)}
                              disabled={busy || client.archived || client.hold}
                              onChange={(e) =>
                                save({
                                  type: "client.task",
                                  id: client.id,
                                  stage: selectedStage.id,
                                  task: id,
                                  done: e.target.checked,
                                })
                              }
                            />
                            <span>
                              <b>{label}</b>
                              <small>
                                {value?.done
                                  ? `${value.actor} / ${dayLabel(value.at)}`
                                  : "Awaiting completion"}
                              </small>
                            </span>
                            {value?.done && <CheckCircle2 size={18} />}
                          </label>
                        );
                      },
                    )}
                    {selectedStage.id === "live" && !p.active && (
                      <p className="context-note">
                        Final approval becomes available once the preceding
                        milestones are complete.
                      </p>
                    )}
                  </section>
                </>
              )}
              {detailTab === "documents" && (
                <section className="section-block">
                  <div className="section-heading">
                    <h2>Client documents</h2>
                    <div className="actions">
                      <Button icon={Link2} onClick={() => setModal("document")}>
                        Add link
                      </Button>
                      <Button
                        icon={Upload}
                        kind="primary"
                        onClick={() => setModal("upload")}
                      >
                        Upload file
                      </Button>
                    </div>
                  </div>
                  {!client.documents.length ? (
                    <Empty icon={FileText} title="No documents yet">
                      Agreements, profiles and logistics materials will appear
                      here.
                    </Empty>
                  ) : (
                    <div className="document-list">
                      {client.documents.map((d) => (
                        <a
                          key={d.id}
                          href={
                            d.fileId
                              ? `${base}/api/files?id=${d.fileId}`
                              : d.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText size={22} />
                          <span>
                            <b>{d.name}</b>
                            <small>
                              {d.category} / {dayLabel(d.at)}
                            </small>
                          </span>
                          <ArrowUpRight size={17} />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {detailTab === "notes" && (
                <section className="section-block">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await save({
                          type: "client.note",
                          id: client.id,
                          text: note,
                        })
                      )
                        setNote("");
                    }}
                  >
                    <Field label="Add an internal note">
                      <textarea
                        rows={4}
                        value={note}
                        maxLength={3000}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Conversation, decision or follow-up"
                        required
                      />
                    </Field>
                    <div className="form-actions">
                      <button className="button primary" disabled={busy}>
                        <Plus size={16} />
                        Add note
                      </button>
                    </div>
                  </form>
                  <div className="notes-list">
                    {client.notes.map((n) => (
                      <article key={n.id}>
                        <header>
                          <b>{n.actor}</b>
                          <time>{dayLabel(n.at)}</time>
                        </header>
                        <p>{n.text}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {detailTab === "activity" && (
                <div className="activity-list">
                  {client.events.map((event) => (
                    <article key={event.id}>
                      <i />
                      <div>
                        <p>{event.message}</p>
                        <span>
                          {event.actor} / {new Date(event.at).toLocaleString()}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <aside className="contact-panel">
              <section>
                <span className="eyebrow">PRIMARY CONTACT</span>
                <h3>{client.contact}</h3>
                {client.email && (
                  <a href={`mailto:${client.email}`}>
                    <Mail size={15} />
                    {client.email}
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`}>
                    <span>{client.phone}</span>
                  </a>
                )}
                <Button icon={Mail} onClick={() => setModal("email")}>
                  Prepare follow-up
                </Button>
              </section>
              <section>
                <span className="eyebrow">ACCOUNT DETAILS</span>
                <dl>
                  <dt>Account / LIS ID</dt>
                  <dd>{client.lisId || "Not created"}</dd>
                  <dt>Expected volume</dt>
                  <dd>{client.volume || "Not entered"}</dd>
                  <dt>Shipping plan</dt>
                  <dd>{client.shipping || "Not confirmed"}</dd>
                </dl>
                {data.settings.orderingPortal && (
                  <a
                    className="text-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={data.settings.orderingPortal}
                  >
                    Ordering & results portal
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </section>
              <section>
                <span className="eyebrow">APPROVED MATERIALS</span>
                {data.resources.length ? (
                  data.resources.slice(0, 6).map((r) => (
                    <a
                      key={r.id}
                      className="resource-mini"
                      href={
                        r.fileId ? `${base}/api/files?id=${r.fileId}` : r.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText size={15} />
                      {r.name}
                      <ArrowUpRight size={14} />
                    </a>
                  ))
                ) : (
                  <p className="muted">No shared materials added yet.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
      {(modal === "create" || modal === "edit") && (
        <ClientForm
          client={modal === "edit" ? client : null}
          close={() => setModal(null)}
          save={save}
          busy={busy}
          actor={actor}
        />
      )}
      {modal === "hold" && (
        <Modal title="Put onboarding on hold" close={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save({
                  type: "client.hold",
                  id: client.id,
                  hold: true,
                  reason: new FormData(e.currentTarget).get("reason"),
                })
              )
                setModal(null);
            }}
          >
            <Field label="Reason">
              <textarea name="reason" required maxLength={300} rows={3} />
            </Field>
            <footer className="form-actions">
              <button className="button primary" disabled={busy}>
                Confirm hold
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {(modal === "document" || modal === "upload") && (
        <Modal
          title={modal === "document" ? "Link a document" : "Upload a document"}
          close={() => setModal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (modal === "upload") {
                if (
                  await uploadDocument(
                    form.get("file"),
                    form.get("category"),
                    form.get("name"),
                  )
                )
                  setModal(null);
              } else if (
                await save({
                  type: "client.document",
                  id: client.id,
                  name: form.get("name"),
                  category: form.get("category"),
                  url: form.get("url"),
                })
              )
                setModal(null);
            }}
          >
            <Field label="Document name">
              <input name="name" required maxLength={160} />
            </Field>
            <Field label="Category">
              <select name="category">
                {[
                  "Service material",
                  "Reference lab agreement",
                  "Signed agreement",
                  "Client profile",
                  "Collection guide",
                  "Rejection criteria",
                  "Shipping plan",
                  "Other",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            {modal === "upload" ? (
              <Field label="File" hint="PDF, DOCX, PNG or JPG. Maximum 2 MB.">
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  required
                />
              </Field>
            ) : (
              <Field label="Secure document link">
                <input name="url" type="url" placeholder="https://" required />
              </Field>
            )}
            <footer className="form-actions">
              <button className="button primary" disabled={busy || uploading}>
                {uploading
                  ? "Uploading..."
                  : modal === "upload"
                    ? "Upload document"
                    : "Add document"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {modal === "email" && client && (
        <FollowUp
          client={client}
          operationsContact={data.settings.ownerName}
          close={() => setModal(null)}
        />
      )}
    </div>
  );
}
function FollowUp({ client, operationsContact, close }) {
  const current = stages[progress(client).index];
  const pending = tasksFor(client.type, current.id)
    .filter(([id]) => !client.tasks[`${current.id}.${id}`]?.done)
    .map(([, label]) => label);
  const [subject, setSubject] = useState(
    `Consultative Genomics | ${client.name} onboarding`,
  );
  const [body, setBody] = useState(
    `Hello ${client.contact},\n\nThank you for connecting with Consultative Genomics.\n\n${progress(client).active ? 'Your onboarding is complete. We look forward to supporting your team.' : `We are currently working through ${current.name.toLowerCase()}. Our outstanding items are:\n${pending.map((t) => `- ${t}`).join("\n")}`}\n\n${client.nextAction ? `Next step: ${client.nextAction}\n\n` : ""}Please let us know if you have questions or need any assistance.\n\nBest regards,\n${client.owner || operationsContact || "Consultative Genomics"}`,
  );
  return (
    <Modal
      wide
      title="Prepare follow-up"
      subtitle="Draft only. Delivery and milestone updates are separate."
      close={close}
    >
      <Field label="To">
        <input value={client.email} readOnly />
      </Field>
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Message">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={13}
        />
      </Field>
      <footer className="form-actions">
        <Button
          icon={Download}
          onClick={() =>
            download(
              "onboarding-follow-up.txt",
              `To: ${client.email}\nSubject: ${subject}\n\n${body}`,
              "text/plain",
            )
          }
        >
          Download draft
        </Button>
        <a
          className="button primary"
          href={`mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        >
          <Mail size={16} />
          Open email draft
        </a>
      </footer>
    </Modal>
  );
}
