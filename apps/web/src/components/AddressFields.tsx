"use client";

import {
  ADDRESS_COUNTRIES,
  US_STATES,
  type AddressParts,
} from "@pool-design/shared";

type Props = {
  idPrefix: string;
  value: AddressParts;
  onChange: (next: AddressParts) => void;
  required?: boolean;
  streetPlaceholder?: string;
};

export function AddressFields({
  idPrefix,
  value,
  onChange,
  required = false,
  streetPlaceholder = "123 Palm Ave",
}: Props) {
  const country = value.country || "US";
  const us = country === "US";

  function set<K extends keyof AddressParts>(key: K, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor={`${idPrefix}-street`}>Street</label>
        <input
          id={`${idPrefix}-street`}
          name={`${idPrefix}Street`}
          value={value.street ?? ""}
          onChange={(e) => set("street", e.target.value)}
          placeholder={streetPlaceholder}
          autoComplete="street-address"
        />
      </div>
      <div className="address-grid">
        <div className="field">
          <label htmlFor={`${idPrefix}-city`}>City</label>
          <input
            id={`${idPrefix}-city`}
            name={`${idPrefix}City`}
            value={value.city ?? ""}
            onChange={(e) => set("city", e.target.value)}
            required={required}
            autoComplete="address-level2"
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-state`}>{us ? "State" : "State / region"}</label>
          {us ? (
            <select
              id={`${idPrefix}-state`}
              name={`${idPrefix}State`}
              value={value.state ?? ""}
              onChange={(e) => set("state", e.target.value)}
              required={required}
              autoComplete="address-level1"
            >
              <option value="">Select</option>
              {US_STATES.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${idPrefix}-state`}
              name={`${idPrefix}State`}
              value={value.state ?? ""}
              onChange={(e) => set("state", e.target.value)}
              required={required}
              autoComplete="address-level1"
            />
          )}
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-postal`}>{us ? "ZIP" : "Postal code"}</label>
          <input
            id={`${idPrefix}-postal`}
            name={`${idPrefix}Postal`}
            value={value.postalCode ?? ""}
            onChange={(e) => set("postalCode", e.target.value)}
            autoComplete="postal-code"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-country`}>Country</label>
        <select
          id={`${idPrefix}-country`}
          name={`${idPrefix}Country`}
          value={country}
          onChange={(e) => set("country", e.target.value)}
          autoComplete="country"
        >
          {ADDRESS_COUNTRIES.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
