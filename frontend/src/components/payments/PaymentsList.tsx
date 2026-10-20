/** @format */

import { Pencil, Trash2, Receipt } from "lucide-react";
import Badge from "../Badge";
import { Card, IconButton } from "../ui";
import { channelLabel } from "../../utils/paymentChannels";
import type { Payment } from "../../types";

interface Props {
  shown: Payment[];
  isOwner: boolean;
  onEdit: (p: Payment) => void;
  onDelete: (p: Payment) => void;
  onReceipt: (p: Payment) => void;
}

export default function PaymentsList({
  shown,
  isOwner,
  onEdit,
  onDelete,
  onReceipt,
}: Props) {
  return (
    <>
      {/* Mobile: cards — an eight-column table cannot fit a phone screen */}
      <div className="space-y-3 md:hidden">
        {shown.map((p) => (
          <Card
            key={p.id}
            className={`p-4 ${p.status === "due" ? "border-red-200 dark:border-red-500/20 bg-red-50/40" : ""}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                  {p.member.name}
                </p>
                {p.member.memberNo && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {p.member.memberNo}
                  </p>
                )}
              </div>
              <p className="font-bold text-gray-900 dark:text-slate-100 shrink-0">
                Rs. {p.amount.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={p.status} />
              <Badge status={p.method} />
              {p.channel && (
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {channelLabel(p.channel)}
                </span>
              )}
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">
                {new Date(p.paymentDate).toLocaleDateString()}
              </span>
            </div>
            {p.notes && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 wrap-break-word">
                {p.notes}
              </p>
            )}
            {/* Correcting the record is the owner's — an entry that can be
                edited by whoever took it is not a record of anything. The
                API refuses staff either way; hiding the buttons just keeps
                them from being offered an action they cannot complete. */}
            {isOwner && (
              <div className="flex items-center gap-1 mt-2 -mb-1 -mr-1">
                {p.recordedBy && (
                  <span className="text-xs text-gray-400 dark:text-slate-500 truncate mr-auto">
                    by {p.recordedBy.name}
                  </span>
                )}
                <IconButton
                  icon={Pencil}
                  label={`Edit payment for ${p.member.name}`}
                  onClick={() => onEdit(p)}
                />
                <IconButton
                  icon={Trash2}
                  tone="red"
                  label={`Delete payment for ${p.member.name}`}
                  onClick={() => onDelete(p)}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800">
              <tr>
                {[
                  "Member",
                  "Amount",
                  "Method",
                  "Date",
                  "Status",
                  "Notes",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300"
                  >
                    {h}
                  </th>
                ))}
                {/* Staff see only their own entries, so "who took this"
                    would tell them nothing they did not already know. */}
                {isOwner && (
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">
                    Taken by
                  </th>
                )}
                <th className="px-4 py-3 w-28 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/60 ${
                    p.status === "due" ? "bg-red-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 max-w-55">
                    <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                      {p.member.name}
                    </p>
                    {p.member.memberNo && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {p.member.memberNo}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                    Rs. {p.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={p.method} />
                    {p.channel && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        {channelLabel(p.channel)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(p.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td
                    className="px-4 py-3 text-gray-500 dark:text-slate-400 max-w-65 truncate"
                    title={p.notes ?? ""}
                  >
                    {p.notes || "—"}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 max-w-35 truncate">
                      {/* An em dash rather than a guess: the row predates
                          the column, or the account that took it is gone. */}
                      {p.recordedBy?.name ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        icon={Receipt}
                        label={`Receipt for ${p.member.name}`}
                        onClick={() => onReceipt(p)}
                      />
                      {isOwner && (
                        <>
                          <IconButton
                            icon={Pencil}
                            label={`Edit payment for ${p.member.name}`}
                            onClick={() => onEdit(p)}
                          />
                          <IconButton
                            icon={Trash2}
                            tone="red"
                            label={`Delete payment for ${p.member.name}`}
                            onClick={() => onDelete(p)}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
