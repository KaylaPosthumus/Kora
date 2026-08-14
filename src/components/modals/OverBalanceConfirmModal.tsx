import React from "react";
import { Modal, Button } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Icons } from "../../constants/icons";

interface OverBalanceConfirmModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employeeName: string;
  requestedDays: number;
  availableDays: number;
  onApprove: () => void;
  onReject: () => void;
}

const OverBalanceConfirmModal: React.FC<OverBalanceConfirmModalProps> = ({
  showModal,
  setShowModal,
  employeeName,
  requestedDays,
  availableDays,
  onApprove,
  onReject,
}) => {
  const overBalanceDays = requestedDays - availableDays;

  const handleApprove = () => {
    onApprove();
    setShowModal(false);
  };

  const handleReject = () => {
    onReject();
    setShowModal(false);
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <Modal
      title={<h2 className="font-bold text-3xl text-center">Over-Balance Request</h2>}
      open={showModal}
      onCancel={handleCancel}
      width={500}
      styles={{
        header: {
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 40,
        },
        body: {
          paddingTop: 16,
          paddingBottom: 16,
          padding: 40,
        },
        footer: {
          paddingLeft: 40,
          paddingRight: 40,
          paddingBottom: 40,
        },
      }}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="reject" danger onClick={handleReject}>
          Reject
        </Button>,
        <Button key="approve" type="primary" onClick={handleApprove}>
          Approve Anyway
        </Button>,
      ]}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-orange-50 rounded-2xl p-4 border-2 border-orange-200">
          <div className="flex items-center gap-3 justify-center">
            <Icons.Warning className="text-orange-500 text-lg " />
            <div>
              <p className="text-orange-700 text-sm font-medium">
                <strong>{employeeName}</strong> is requesting too many days for how many days they
                have left.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-zinc-600">Requested:</span>
            <span className="font-medium text-zinc-900">{requestedDays} days</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-zinc-600">Available:</span>
            <span className="font-medium text-zinc-900">{availableDays} days</span>
          </div>
          <hr className="my-2 border-zinc-600" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-600">Over by:</span>
            <span className="font-bold text-red-600">{overBalanceDays} days</span>
          </div>
        </div>

        <p className="text-sm text-center text-zinc-600">What do you wish to do?</p>
      </div>
    </Modal>
  );
};

export default OverBalanceConfirmModal;
