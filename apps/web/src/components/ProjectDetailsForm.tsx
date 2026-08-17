"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AddressParts } from "@pool-design/shared";
import { AddressFields } from "@/components/AddressFields";

export type ProjectDetailsValue = {
  name: string;
  clientName: string;
  phone: string;
} & AddressParts;

type Props = {
  projectId: string;
  initial: ProjectDetailsValue;
};

export function ProjectDetailsForm({ projectId, initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [clientName, setClientName] = useState(initial.clientName);
  const [phone, setPhone] = useState(initial.phone);
  const [site, setSite] = useState<AddressParts>({
    street: initial.street ?? "",
    city: initial.city ?? "",
    state: initial.state ?? "",
    postalCode: initial.postalCode ?? "",
    country: initial.country ?? "US",
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientName,
          phone,
          street: site.street,
          city: site.city,
          state: site.state,
          postalCode: site.postalCode,
          country: site.country,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save details");
      setMsg("Project details saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(e) => void save(e)}>
      <div className="field">
        <label htmlFor="projectName">Project name</label>
        <input
          id="projectName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="contactName">Contact name</label>
          <input
            id="contactName"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Who to call on site"
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="contactPhone">Phone</label>
          <input
            id="contactPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="407-555-0142"
            autoComplete="tel"
          />
        </div>
      </div>
      <div>
        <p className="muted" style={{ margin: "0 0 0.5rem" }}>
          Job site — city and state are used on Markets.
        </p>
        <AddressFields
          idPrefix="job"
          value={site}
          onChange={setSite}
          streetPlaceholder="Job site street"
        />
      </div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save details"}
      </button>
      {msg ? <p className="muted">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
