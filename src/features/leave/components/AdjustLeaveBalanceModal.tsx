import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Select, Segmented, InputNumber, Input, message } from "antd";
import { Icons } from "@/constants/icons";
import type { LeaveBalance } from "@/shared/types/leaveBalance";
import {
  leaveBalanceAPI,
  describeAdjustResult,
  MAX_REASON_LENGTH,
  type AdjustBalanceResult,
} from "@/features/leave/api/leaveBalanceApi";
import { CallableError } from "@/shared/lib/callable";

interface AdjustLeaveBalanceModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employeeId: string;
  employeeName: string;
  balances: LeaveBalance[];
  /** Called after a balance actually moved, so the page can re-read. */
  onAdjusted: () => void;
}

/**
 * Correcting one employee's leave balance.
 *
 * A balance is entitlement, so every path through this form ends in an audit
 * entry naming who changed it and why — which is the reason it goes through the
 * `adjustLeaveBalance` callable rather than writing the document directly.
 *
 * Two deliberate choices. The reason is required by the backend and so is
 * required here, rather than being sent empty and bounced. And a correction that
 * would take the balance below zero is not refused: the callable answers
 * `would-go-negative`, this shows what the result would be, and the admin may
 * confirm — mirroring how approving over-balance leave already works.
 */
const AdjustLeaveBalanceModal: React.FC<AdjustLeaveBalanceModalProps> = ({
  showModal,
  setShowModal,
  employeeId,
  employeeName,
  balances,
  onAdjusted,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [leaveTypeId, setLeaveTypeId] = useState<string | undefined>();
  const [mode, setMode] = useState<"set" | "delta">("delta");
  const [days, setDays] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Set once the backend says the change is legal but goes negative.
  const [negativeWarning, setNegativeWarning] = useState<{ after: number } | null>(null);

  // Reopening the modal should not show the previous correction.
  useEffect(() => {
    if (!showModal) return;
    setLeaveTypeId(balances[0]?.leaveBalanceId);
    setMode("delta");
    setDays(null);
    setReason("");
    setNegativeWarning(null);
    setSubmitting(false);
  }, [showModal, balances]);

  const selected = useMemo(
    () => balances.find((b) => b.leaveBalanceId === leaveTypeId),
    [balances, leaveTypeId]
  );

  const projected = useMemo(() => {
    if (selected === undefined || days === null) return null;
    return mode === "set" ? days : selected.remainingDays + days;
  }, [selected, days, mode]);

  const canSubmit =
    leaveTypeId !== undefined && days !== null && reason.trim().length > 0 && !submitting;

  const submit = async (allowNegative: boolean) => {
    if (leaveTypeId === undefined || days === null) return;
    setSubmitting(true);
    try {
      const { data } = await leaveBalanceAPI.adjust({
        employeeId,
        leaveTypeId,
        mode,
        days,
        reason: reason.trim(),
        allowNegative,
      });
      handleResult(data);
    } catch (error) {
      // Only transport and auth failures land here; every verdict is `data`.
      const text =
        error instanceof CallableError && error.status === 401
          ? "Your session expired. Sign in again."
          : "Could not reach the server. Nothing was changed.";
      messageApi.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResult = (result: AdjustBalanceResult) => {
    if (result.status === "ok") {
      messageApi.success(describeAdjustResult(result));
      onAdjusted();
      setShowModal(false);
      return;
    }
    if (result.status === "would-go-negative") {
      setNegativeWarning({ after: result.after });
      return;
    }
    messageApi.warning(describeAdjustResult(result));
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="font-bold text-3xl text-center">Correct Leave Balance</h2>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={520}
        styles={{
          header: { paddingLeft: 40, paddingRight: 40, paddingTop: 40 },
          body: { padding: 40, paddingTop: 16, paddingBottom: 16 },
          footer: { paddingLeft: 40, paddingRight: 40, paddingBottom: 40 },
        }}
        footer={
          negativeWarning
            ? [
                <Button key="back" onClick={() => setNegativeWarning(null)}>
                  Back
                </Button>,
                <Button key="anyway" type="primary" danger loading={submitting} onClick={() => submit(true)}>
                  Apply Anyway
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>,
                <Button
                  key="apply"
                  type="primary"
                  loading={submitting}
                  disabled={!canSubmit}
                  onClick={() => submit(false)}
                >
                  Apply Correction
                </Button>,
              ]
        }
      >
        {negativeWarning ? (
          <div className="flex flex-col gap-4">
            <div className="bg-orange-50 rounded-2xl p-4 border-2 border-orange-200">
              <div className="flex items-center gap-3 justify-center">
                <Icons.Warning className="text-orange-500 text-lg" />
                <p className="text-orange-700 text-sm font-medium">
                  This takes <strong>{employeeName}</strong>&apos;s{" "}
                  {selected?.leaveTypeName} balance to{" "}
                  <strong>{negativeWarning.after} days</strong>.
                </p>
              </div>
            </div>
            <p className="text-sm text-center text-zinc-600">
              A negative balance is allowed — it just means days owed. Apply it?
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-zinc-500">Leave type</label>
              <Select
                className="w-full"
                value={leaveTypeId}
                onChange={setLeaveTypeId}
                options={balances.map((b) => ({
                  value: b.leaveBalanceId,
                  label: `${b.leaveTypeName} — ${b.remainingDays} of ${b.defaultDays} days left`,
                }))}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500">Change</label>
              <Segmented
                block
                value={mode}
                onChange={(value) => setMode(value as "set" | "delta")}
                options={[
                  { label: "Add or remove days", value: "delta" },
                  { label: "Set an exact figure", value: "set" },
                ]}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500">
                {mode === "delta" ? "Days to add (negative removes)" : "New balance, in days"}
              </label>
              <InputNumber
                className="w-full"
                value={days}
                onChange={setDays}
                precision={0}
                min={mode === "set" ? 0 : undefined}
              />
            </div>

            {selected && projected !== null && (
              <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-zinc-600">Now:</span>
                  <span className="font-medium text-zinc-900">
                    {selected.remainingDays} days
                  </span>
                </div>
                <hr className="my-2 border-zinc-300" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-600">After:</span>
                  <span
                    className={`font-bold ${projected < 0 ? "text-red-600" : "text-zinc-900"}`}
                  >
                    {projected} days
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-500">Reason (recorded on the audit trail)</label>
              <Input.TextArea
                rows={3}
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                showCount
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Pro-rata allowance for a June start date"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default AdjustLeaveBalanceModal;
