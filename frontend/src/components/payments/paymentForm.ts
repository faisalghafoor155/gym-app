/** @format */

import type {
  PaymentChannel,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "../../types";

export interface PaymentForm {
  memberId: string;
  amount: string;
  method: PaymentMethod;
  /** Which wallet the money came through. '' on cash, and until one is picked. */
  channel: PaymentChannel | "";
  reference: string;
  notes: string;
  status: PaymentStatus;
  type: PaymentType;
  /** '' means "not against a membership", which is what the API stores as null. */
  membershipId: string;
  paymentDate: string;
}

export const today = () => new Date().toISOString().split("T")[0]!;

export const emptyForm = (): PaymentForm => ({
  memberId: "",
  amount: "",
  method: "cash",
  channel: "",
  reference: "",
  notes: "",
  status: "paid",
  type: "membership",
  membershipId: "",
  paymentDate: today(),
});

export const TYPE_LABELS: Record<PaymentType, string> = {
  membership: "Membership fee",
  supplement: "Supplement",
  other: "Other",
};

export type Filter = "all" | PaymentStatus;

export const FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "paid" as const, label: "Paid" },
  { value: "due" as const, label: "Due" },
];

/** Rows per request. The table stops being something anyone reads long before
 *  this, so the rest are fetched on demand rather than shipped up front. */
export const PAGE_SIZE = 50;

/** How many months of history the summary covers — the same window as the
 *  supplement sales report, so the two pages line up month for month. */
export const SUMMARY_MONTHS = 6;
