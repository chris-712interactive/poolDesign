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
  compact = false,
}: {
  enabledLevels: DesignLevel[];
  heading?: string;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [site, setSite] = useState<AddressParts>({
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  return (
    <form action={createProjectAction} className="stack" data-tour="create-project">
      {compact ? null : <h2>{heading}</h2>}
      <div className="field">
        <label htmlFor="name">Project name</label>
        <input
          id="name"
          name="name"
          required
          placeholder="Smith Residence Pool"
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="clientName">Contact name</label>
          <input
            id="clientName"
            name="clientName"
            placeholder="Who to call on site"
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="407-555-0142"
            autoComplete="tel"
          />
        </div>
      </div>
      <div>
        {compact ? null : (
          <p className="muted" style={{ margin: "0 0 0.5rem" }}>
            Job site — city and state are used to see where work is coming from.
          </p>
        )}
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
