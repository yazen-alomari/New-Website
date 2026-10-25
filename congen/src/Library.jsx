import { useState } from "react";
import {
  ArrowUpRight,
  Download,
  FileText,
  FolderOpen,
  Link2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Field,
  IconButton,
  Modal,
  download,
} from "./components.jsx";
import { base, request } from "./api.js";
import { dayLabel, isoDay } from "./model.js";

export function Materials({ data, save, busy, onData, notify }) {
  const [modal, setModal] = useState(null),
    [filter, setFilter] = useState("All materials"),
    [uploading, setUploading] = useState(false);
  const categories = [
    "Service material",
    "Reference lab agreement",
    "Client profile",
    "Collection guide",
    "Rejection criteria",
    "Shipping plan",
    "Other",
  ];
  const resources = data.resources.filter(
    (r) => filter === "All materials" || r.category === filter,
  );
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (modal === "link") {
      if (await save({ type: "resource.save", ...Object.fromEntries(form) }))
        setModal(null);
      return;
    }
    setUploading(true);
    try {
      const file = form.get("file");
      if (file.size > 2000000)
        throw new Error("Choose a file smaller than 2 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      for (let i = 0; i < bytes.length; i += 8192)
        raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const response = await request("files", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          category: form.get("category"),
          filename: file.name,
          content: btoa(raw),
          revision: data.revision,
        }),
      });
      onData(response);
      setModal(null);
      notify("Material saved");
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("congen-error", { detail: error.message }),
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM RESOURCES</span>
          <h1>Materials library</h1>
          <p>Approved agreements, profiles and collection materials.</p>
        </div>
        <div className="actions">
          <Button icon={Link2} onClick={() => setModal("link")}>
            Add link
          </Button>
          <Button icon={Upload} kind="primary" onClick={() => setModal("file")}>
            Upload material
          </Button>
        </div>
      </div>
      <div className="list-toolbar">
        <select
          aria-label="Material category"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All materials", ...categories].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="muted">{resources.length} materials</span>
      </div>
      {resources.length ? (
        <div className="resource-grid">
          {resources.map((r) => (
            <article className="resource-item" key={r.id}>
              <div className="split">
                <FileText size={26} strokeWidth={1.4} />
                <IconButton
                  icon={Trash2}
                  label={`Remove ${r.name}`}
                  disabled={busy}
                  onClick={async () => {
                    if (window.confirm(`Remove ${r.name} from the library?`))
                      await save({ type: "resource.delete", id: r.id });
                  }}
                />
              </div>
              <Badge>{r.category}</Badge>
              <h3>{r.name}</h3>
              <footer>
                <small>Added {dayLabel(r.at)}</small>
                <a
                  className="text-link"
                  href={r.fileId ? `${base}/api/files?id=${r.fileId}` : r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.fileId ? "Download" : "Open"}
                  {r.fileId ? (
                    <Download size={15} />
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                </a>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={FolderOpen}
          title="Ready for your approved materials"
          action={
            <Button icon={Plus} onClick={() => setModal("file")}>
              Add first material
            </Button>
          }
        >
          No {filter === "All materials" ? "materials" : filter.toLowerCase()}{" "}
          have been added.
        </Empty>
      )}
      {modal && (
        <Modal
          title={
            modal === "file"
              ? "Upload approved material"
              : "Link approved material"
          }
          close={() => !uploading && setModal(null)}
        >
          <form onSubmit={submit}>
            <Field label="Material name">
              <input name="name" required maxLength={160} />
            </Field>
            <Field label="Category">
              <select name="category">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {modal === "file" ? (
              <Field label="File" hint="PDF, DOCX, PNG or JPG. Maximum 2 MB.">
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  required
                />
              </Field>
            ) : (
              <Field label="Secure material link">
                <input type="url" name="url" placeholder="https://" required />
              </Field>
            )}
            <footer className="form-actions">
              <button className="button primary" disabled={busy || uploading}>
                {uploading ? "Uploading..." : "Save material"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function Settings({ data, save, busy, notify }) {
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Workspace settings</h1>
          <p>Team identity, account access and data.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="section-block">
          <h2>Organization</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save({
                  type: "settings.save",
                  value: Object.fromEntries(new FormData(e.currentTarget)),
                })
              )
                notify("Settings saved");
            }}
          >
            <Field label="Workspace name">
              <input
                name="teamName"
                maxLength={120}
                required
                defaultValue={data.settings.teamName}
              />
            </Field>
            <Field label="Operations contact">
              <input
                name="ownerName"
                maxLength={120}
                required
                defaultValue={data.settings.ownerName}
              />
            </Field>
            <Field label="Ordering & results portal URL">
              <input
                name="orderingPortal"
                type="url"
                placeholder="https://"
                defaultValue={data.settings.orderingPortal}
              />
            </Field>
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                <Save size={16} />
                Save settings
              </button>
            </div>
          </form>
        </section>
        <div>
          <section className="section-block">
            <div className="section-heading">
              <h2>Team access</h2>
              <ShieldCheck size={20} />
            </div>
            <dl className="settings-facts">
              <dt>Access</dt>
              <dd>Shared team key</dd>
              <dt>Session</dt>
              <dd>8 hours</dd>
              <dt>Storage</dt>
              <dd>Private, shared workspace</dd>
              <dt>Permissions</dt>
              <dd>All team members can edit</dd>
            </dl>
            <p className="context-note">
              Activity names are self-reported, not verified user identities.
              Organization onboarding only. Do not store patient data or
              protected health information.
            </p>
          </section>
          <section className="section-block">
            <h2>Workspace backup</h2>
            <p className="muted">
              Client records, milestone history, scenarios and material
              references. Uploaded files are downloaded separately.
            </p>
            <Button
              icon={Download}
              onClick={() =>
                download(
                  `congen-workspace-${isoDay()}.json`,
                  JSON.stringify(
                    { exportedAt: new Date().toISOString(), ...data },
                    null,
                    2,
                  ),
                )
              }
            >
              Export workspace
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
