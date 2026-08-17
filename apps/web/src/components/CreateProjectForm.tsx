"use client";

import { useState } from "react";
import {
  DESIGN_LEVEL_LABELS,
  type AddressParts,
  type DesignLevel,
} from "@pool-design/shared";
import { AddressFields } from "@/components/AddressFields";
import { createProjectAction } from "@/lib/createProject";

export function CreateProjectForm({
  enabledLevels,
  heading = "New project",
  submitLabel = "Create project",
}: {
  enabledLevels: DesignLevel[];
  heading?: string;
  submitLabel?: string;
}) {
  const [site, setSite] = useState<AddressParts>({
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  return (
    <form action={createProjectAction} className="stack">
      <h2>{heading}</h2>
      <div className="field">
        <label htmlFor="name">Project name</label>
        <input
          id="name"
          name="name"
          required
          placeholder="Smith Residence Pool"
        />
      </div>
      <div className="field">
        <label htmlFor="clientName">Client</label>
        <input id="clientName" name="clientName" placeholder="Client name" />
      </div>
      <div>
        <p className="muted" style={{ margin: "0 0 0.5rem" }}>
          Job site — city and state are used to see where work is coming from.
        </p>
        <AddressFields
          idPrefix="job"
          value={site}
          onChange={setSite}
          streetPlaceholder="Job site street"
        />
      </div>
      <div className="field">
        <label htmlFor="designLevel">Design level</label>
        <select id="designLevel" name="designLevel" defaultValue="residential">
          {enabledLevels.map((level) => (
            <option key={level} value={level}>
              {DESIGN_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </div>
      <button className="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
