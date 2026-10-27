/** @format */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  X,
  Download,
  CreditCard,
  Wallet,
  AlertCircle,
  Receipt,
} from "lucide-react";
import ReceiptModal from "../components/ReceiptModal";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  Page,
  PageHeader,
  Card,
  StatTile,
  PageLoader,
  EmptyState,
  Refetching,
  SegmentedControl,
  inputClass,
  primaryButton,
  secondaryButton,
} from "../components/ui";
import MonthlyTotals from "../components/payments/MonthlyTotals";
import PaymentsList from "../components/payments/PaymentsList";
import PaymentFormModal from "../components/payments/PaymentFormModal";
import {
  emptyForm,
  FILTERS,
  PAGE_SIZE,
  SUMMARY_MONTHS,
  type Filter,
  type PaymentForm,
} from "../components/payments/paymentForm";
import { useDebounced } from "../hooks/useDebounced";
import { downloadFromServer } from "../utils/csv";
import api, { apiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type {
  Payment,
  Member,
  GymSettings,
  PaymentSummary,
  Paginated,
  PaginatedPayments,
} from "../types";
import toast from "react-hot-toast";


export default function Payments() {
  const { isOwner } = useAuth();
  const { t } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** How many rows match the filters in total, not how many are on screen. */
  const [total, setTotal] = useState(0);
  /** Totalled by the server over everything matching the filters — see
   *  PaginatedPayments. Summing `payments` here would only total this page. */
  const [totals, setTotals] = useState({ collected: 0, outstanding: 0 });
  const [params, setParams] = useSearchParams();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Payment | null>(null);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  /** Only for the account line under the channel picker — the gym's published
   *  details, so the front desk can read out where to send the money. */
  const [settings, setSettings] = useState<GymSettings | null>(null);

  // First paint shows a spinner; every later fetch dims the old list instead,
  // so typing in the search box does not blank the page.
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (filter !== "all") q.set("status", filter);
    // Blank values are omitted rather than sent — the API rejects "" for a date.
    if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("limit", String(PAGE_SIZE));
    return `?${q.toString()}`;
  }, [filter, debouncedSearch, from, to]);

  // Page one whenever the filters change: page three of the old result set
  // has nothing to do with the new one.
  useEffect(() => {
    let cancelled = false;
    setRefetching(true);
    api
      .get<PaginatedPayments>(`/payments${query}`)
      .then((r) => {
        if (cancelled) return;
        setPayments(r.data.data);
        setTotals({
          collected: r.data.collected,
          outstanding: r.data.outstanding,
        });
        setTotal(r.data.total);
        setHasMore(r.data.hasMore);
        setPage(1);
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiError(err, t("Could not load payments")));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefetching(false);
        }
      });
    // A slow earlier response must not overwrite a newer one.
    return () => {
      cancelled = true;
    };
    // `t` only words the error toast; a language switch is no reason to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /**
   * Appends the next page rather than replacing the list, so "Show more" grows
   * what is on screen the way it always did — the rows now come from the server
   * one page at a time instead of all having been downloaded up front.
   */
  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    api
      .get<PaginatedPayments>(`/payments${query}&page=${next}`)
      .then((r) => {
        setPayments((prev) => [...prev, ...r.data.data]);
        setHasMore(r.data.hasMore);
        setPage(next);
      })
      .catch((err) =>
        toast.error(apiError(err, t("Could not load more payments"))),
      )
      .finally(() => setLoadingMore(false));
  };

  // The member list never changes with the filters, so it loads once. The
  // picker has to offer every member, hence all=true.
  useEffect(() => {
    api
      .get<Paginated<Member>>("/members?all=true")
      .then((r) => setMembers(r.data.data))
      .catch(() => {
        /* the payments error toast already covers a dead API */
      });

    // Only feeds the account hint under the channel picker, so a failure is
    // silent — the form still records the payment without it.
    api
      .get<GymSettings>("/gym-settings")
      .then((r) => setSettings(r.data))
      .catch(() => {
        /* the hint simply says nothing */
      });
  }, []);

  /**
   * The gym's books, month by month. Owner-only — the API refuses staff, so
   * asking as staff would earn nothing but a 403 and a toast.
   *
   * Deliberately not filtered: the tiles above the table follow the filters and
   * say so, while this answers "what did the gym take in August", which no
   * filter should be able to change the answer to.
   */
  const loadSummary = useMemo(
    () => () => {
      if (!isOwner) return Promise.resolve();
      return api
        .get<PaymentSummary>(`/payments/summary?months=${SUMMARY_MONTHS}`)
        .then((r) => setSummary(r.data))
        .catch((err) =>
          toast.error(apiError(err, t("Could not load the monthly totals"))),
        );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOwner],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // The dashboard's "Record Payment" shortcut lands here as ?new=1. The param
  // is cleared once used, so refreshing does not reopen the modal.
  useEffect(() => {
    if (!params.get("new")) return;
    openAdd();
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("new");
        return next;
      },
      { replace: true },
    );
    // Runs on the landing param only — this is a hint, not a live binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recording or correcting a payment moves the month's total too, so the
  // summary is refreshed alongside the list rather than going stale until the
  // next page load.
  // Back to page one: a correction can move a row out of the current filter
  // entirely, and re-fetching a later page would leave a gap above it.
  const reload = () =>
    Promise.all([
      api
        .get<PaginatedPayments>(`/payments${query}`)
        .then((r) => {
          setPayments(r.data.data);
          setTotals({
            collected: r.data.collected,
            outstanding: r.data.outstanding,
          });
          setTotal(r.data.total);
          setHasMore(r.data.hasMore);
          setPage(1);
        })
        .catch((err) => toast.error(apiError(err, t("Could not load payments")))),
      loadSummary(),
    ]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      memberId: p.memberId,
      amount: String(p.amount),
      method: p.method,
      channel: p.channel ?? "",
      reference: p.reference ?? "",
      notes: p.notes ?? "",
      status: p.status,
      type: p.type,
      membershipId: p.membershipId ?? "",
      paymentDate: p.paymentDate.split("T")[0]!,
    });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // The select uses '' for "no membership"; the API wants null. Only a
      // membership payment carries a link at all, so switching the type to
      // supplement or other drops any membership that was picked earlier
      // rather than leaving a stale one attached.
      const payload = {
        ...form,
        membershipId:
          form.type === "membership" && form.membershipId
            ? form.membershipId
            : null,
        // Cash carries no channel — the API rejects the contradiction outright.
        // Switching an online payment back to cash has to send the null, not
        // omit the field, or the wallet's name stays on a cash row.
        channel: form.method === "cash" ? null : form.channel || null,
        reference:
          form.method === "cash" ? null : form.reference.trim() || null,
      };
      if (editing) {
        // The member a payment belongs to is not editable — the API rejects it,
        // and moving money between members should be a delete and a re-entry.
        const { memberId: _memberId, ...editable } = payload;
        await api.put(`/payments/${editing.id}`, editable);
        toast.success(t("Payment updated"));
      } else {
        await api.post("/payments", payload);
        toast.success(t("Payment recorded"));
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm());
      await reload();
    } catch (err) {
      // The modal stays open with its values intact, so a rejected save is one
      // correction away from succeeding.
      toast.error(apiError(err, t("Could not save the payment")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.delete(`/payments/${deleting.id}`);
      toast.success(t("Payment deleted"));
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t("Could not delete the payment")));
    } finally {
      setSaving(false);
    }
  };

  const hasFilters =
    filter !== "all" || search !== "" || from !== "" || to !== "";
  const clearFilters = () => {
    setFilter("all");
    setSearch("");
    setFrom("");
    setTo("");
  };

  const { collected, outstanding } = totals;

  /**
   * Export all payments matching the current filters as CSV from the server.
   * This fetches the complete filtered dataset, not just loaded rows.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      // The same filters the list is showing, so the file matches the screen —
      // minus the paging, which is the whole point of exporting on the server.
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);
      if (search) params.append("search", search);
      if (from) params.append("from", from);
      if (to) params.append("to", to);

      await downloadFromServer(`/api/payments/export/csv?${params}`);
      toast.success(
        t(total === 1 ? "Exported {count} payment" : "Exported {count} payments", {
          count: total,
        }),
      );
    } catch (err) {
      console.error("Export failed:", err);
      toast.error(err instanceof Error ? err.message : t("Failed to export CSV"));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <PageLoader />;

  const shown = payments;

  return (
    <Page>
      <PageHeader
        icon={CreditCard}
        title={t("Payments")}
        subtitle={
          isOwner
            ? t("What the gym has taken, and what is still owed")
            : t("Fees you have recorded, and who still owes")
        }
        action={
          <button onClick={openAdd} className={primaryButton}>
            <Plus size={16} />
            <span className="hidden sm:inline">{t("Record Payment")}</span>
            <span className="sm:hidden">{t("Record")}</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <StatTile
          icon={Wallet}
          tone="green"
          label={t("Collected")}
          value={`Rs. ${collected.toLocaleString()}`}
          hint={hasFilters ? t("matching filters") : undefined}
        />
        <StatTile
          icon={AlertCircle}
          tone="red"
          label={t("Outstanding")}
          value={`Rs. ${outstanding.toLocaleString()}`}
          hint={hasFilters ? t("matching filters") : undefined}
        />
        <StatTile
          icon={Receipt}
          tone="blue"
          label={t("Payments")}
          value={total}
          hint={hasFilters ? t("matching filters") : undefined}
        />
      </div>

      {/*
        Month by month, owner-only.

        Sits apart from the tiles above because it answers a different question:
        those follow the filters and say so, this is the gym's books and no
        filter should be able to change what August took in.

        Split by what the money was for — membership fees and supplement sales
        come through the same till, and a lone grand total reconciles against
        nothing.
      */}
      {isOwner && summary && <MonthlyTotals summary={summary} />}

      {/* Filters */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({ ...f, label: t(f.label) }))}
          />

          <div className="relative flex-1 min-w-50">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search member, phone or member no...")}
              aria-label={t("Search payments")}
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t("From date")}
              className={`${inputClass} w-auto`}
            />
            <span className="text-gray-400 dark:text-slate-500 text-sm">
              {t("to")}
            </span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t("To date")}
              className={`${inputClass} w-auto`}
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className={secondaryButton}>
              <X size={14} /> {t("Clear")}
            </button>
          )}

          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className={`${secondaryButton} ml-auto`}
            title={t("Exports every payment matching these filters, not just this page")}
          >
            <Download size={14} />{" "}
            <span className="hidden sm:inline">
              {exporting ? t("Exporting…") : t("Export CSV")}
            </span>
          </button>
        </div>
      </Card>

      {payments.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title={t("No payments match these filters")}
            hint={t("Try a different date range, status or search term.")}
            action={
              <button onClick={clearFilters} className={secondaryButton}>
                <X size={14} /> {t("Clear filters")}
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Receipt}
            title={
              isOwner
                ? t("No payments recorded yet")
                : t("You have not recorded any payments yet")
            }
            hint={
              isOwner
                ? t("Every fee a member pays is logged here, so the books and the renewal list stay honest.")
                : t("Fees you take are logged here. The gym’s full books are the owner’s to see.")
            }
            action={
              <button onClick={openAdd} className={primaryButton}>
                <Plus size={16} /> {t("Record the first payment")}
              </button>
            }
          />
        )
      ) : (
        <Refetching busy={refetching}>
          <PaymentsList
            shown={shown}
            isOwner={isOwner}
            onEdit={openEdit}
            onDelete={setDeleting}
            onReceipt={setActiveReceipt}
          />

          {hasMore && (
            <div className="flex justify-center mt-5">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className={secondaryButton}
              >
                {loadingMore
                  ? t("Loading…")
                  : t("Show more · {count} left", {
                      count: total - payments.length,
                    })}
              </button>
            </div>
          )}
        </Refetching>
      )}

      {showModal && (
        <PaymentFormModal
          editing={editing}
          form={form}
          setForm={setForm}
          members={members}
          settings={settings}
          saving={saving}
          onClose={() => setShowModal(false)}
          onSubmit={(e) => void handleSave(e)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t("Delete payment")}
          message={t(
            "Delete the Rs. {amount} payment from {name}? This removes it from the books and cannot be undone — it is recorded in the audit log.",
            { amount: deleting.amount.toLocaleString(), name: deleting.member.name },
          )}
          busy={saving}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}

      {activeReceipt && (
        <ReceiptModal
          payment={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </Page>
  );
}