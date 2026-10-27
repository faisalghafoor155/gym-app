/** @format */

import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import Modal from "../Modal";
import { useLanguage } from "../../context/LanguageContext";
import { FieldLabel, inputClass, primaryButton, secondaryButton } from "../ui";
import {
  CHANNELS,
  CHANNEL_LABELS,
  accountFor,
} from "../../utils/paymentChannels";
import type {
  GymSettings,
  Member,
  Payment,
  PaymentMethod,
  PaymentType,
} from "../../types";
import { TYPE_LABELS, today, type PaymentForm } from "./paymentForm";

interface Props {
  editing: Payment | null;
  form: PaymentForm;
  setForm: Dispatch<SetStateAction<PaymentForm>>;
  members: Member[];
  settings: GymSettings | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export default function PaymentFormModal({
  editing,
  form,
  setForm,
  members,
  settings,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useLanguage();
  const set =
    (k: keyof PaymentForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // The member the form is about — the picked one when adding, the payment's
  // own when editing, since the member select is read-only there.
  const formMember = members.find(
    (m) => m.id === (editing ? editing.memberId : form.memberId),
  );

  return (
    <Modal
      title={editing ? t("Edit Payment") : t("Record Payment")}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          {/* Points at the picker, which only the add form renders. When
              editing there is no control to name — the member is shown as
              text — and a label pointing at nothing is inert rather than
              wrong. */}
          <FieldLabel htmlFor="payments-member" required>{t("Member")}</FieldLabel>
          {editing ? (
            // Reassigning a payment is a delete and a re-entry, so the trail
            // shows both. Shown read-only rather than hidden.
            <p className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 text-sm text-gray-600 dark:text-slate-300">
              {editing.member.name}
            </p>
          ) : (
            <select
              id="payments-member"
              required
              value={form.memberId}
              // Changing the member invalidates any membership already
              // picked — it belongs to the previous one.
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  memberId: e.target.value,
                  membershipId: "",
                }))
              }
              className={inputClass}
            >
              <option value="">{t("Select member...")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.phone ? ` · ${m.phone}` : ""}
                </option>
              ))}
            </select>
          )}
          {!editing && members.length === 0 && (
            <p className="text-xs text-yellow-700 mt-1.5">
              {t("No members yet — add a member before recording a payment.")}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="payments-for">{t("For")}</FieldLabel>
          <select id="payments-for"
            value={form.type}
            onChange={set("type")}
            className={inputClass}
          >
            {(Object.keys(TYPE_LABELS) as PaymentType[]).map((type) => (
              <option key={type} value={type}>
                {t(TYPE_LABELS[type])}
              </option>
            ))}
          </select>
        </div>

        {/* Which membership this settles. Offered only for membership money,
            and only once a member is chosen — there is nothing to list
            before that. */}
        {form.type === "membership" && formMember && (
          <div>
            <FieldLabel htmlFor="payments-membership">{t("Membership")}</FieldLabel>
            {formMember.currentMembership ? (
              <select
                id="payments-membership"
                value={form.membershipId}
                onChange={set("membershipId")}
                className={inputClass}
              >
                <option value="">{t("Not linked to a membership")}</option>
                <option value={formMember.currentMembership.id}>
                  {formMember.currentMembership.planName}
                  {" · Rs. "}
                  {formMember.currentMembership.pricePaid.toLocaleString()}
                  {` · ${t("expires")} `}
                  {new Date(
                    formMember.currentMembership.expiryDate,
                  ).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </option>
              </select>
            ) : (
              <p className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 text-sm text-gray-500 dark:text-slate-400">
                {t("This member has no membership to link to.")}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
              {t(
                "Linking is what lets the app tell a paid-up membership from an unpaid one.",
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="payments-amount-rs" required>{t("Amount (Rs.)")}</FieldLabel>
            <input id="payments-amount-rs"
              type="number"
              required
              min="1"
              step="any"
              value={form.amount}
              onChange={set("amount")}
              className={inputClass}
              placeholder="2500"
            />
          </div>
          <div>
            <FieldLabel htmlFor="payments-date" required>{t("Date")}</FieldLabel>
            <input id="payments-date"
              type="date"
              required
              max={today()}
              value={form.paymentDate}
              onChange={set("paymentDate")}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="payments-method">{t("Method")}</FieldLabel>
            <select id="payments-method"
              value={form.method}
              onChange={(e) => {
                const method = e.target.value as PaymentMethod;
                // Switching to cash drops the wallet details with it —
                // leaving them would send a channel the API rejects, and
                // show one on a row that never had it.
                setForm((f) => ({
                  ...f,
                  method,
                  ...(method === "cash" && { channel: "", reference: "" }),
                }));
              }}
              className={inputClass}
            >
              <option value="cash">{t("Cash")}</option>
              <option value="online">{t("Online")}</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="payments-status">{t("Status")}</FieldLabel>
            <select id="payments-status"
              value={form.status}
              onChange={set("status")}
              className={inputClass}
            >
              <option value="paid">{t("Paid")}</option>
              <option value="due">{t("Due")}</option>
            </select>
          </div>
        </div>

        {/* Which wallet, and its transaction id. Only meaningful for money
            that came in online — cash has no channel to record. */}
        {form.method === "online" && (
          // Stacked on a phone: "Bank Transfer" and a transaction id do
          // not both fit in half of a 360px screen, and a channel nobody
          // can read is a channel picked wrong.
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="payments-received-in">{t("Received in")}</FieldLabel>
              <select id="payments-received-in"
                value={form.channel}
                onChange={set("channel")}
                className={inputClass}
              >
                <option value="">{t("Select account")}</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {t(CHANNEL_LABELS[c])}
                  </option>
                ))}
              </select>
              {accountFor(settings, form.channel) && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 break-words">
                  {accountFor(settings, form.channel)}
                </p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="payments-transaction-id">{t("Transaction ID")}</FieldLabel>
              <input id="payments-transaction-id"
                type="text"
                maxLength={100}
                value={form.reference}
                onChange={set("reference")}
                placeholder={t("Optional")}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <FieldLabel htmlFor="payments-notes">{t("Notes")}</FieldLabel>
          <input id="payments-notes"
            type="text"
            maxLength={500}
            value={form.notes}
            onChange={set("notes")}
            className={inputClass}
            placeholder={t("Optional note...")}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => onClose()}
            className={`flex-1 ${secondaryButton}`}
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`flex-1 ${primaryButton}`}
          >
            {saving
              ? t("Saving...")
              : editing
                ? t("Save changes")
                : t("Record")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
