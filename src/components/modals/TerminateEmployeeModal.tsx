import React from "react";
import { Modal, Button, message } from "antd";
import { employeeAPI } from "../../services/api.service";
import { useNavigate } from "react-router-dom";

interface TerminateEmployeeModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employeeFullName: string;
  employeeId: string;
}

function TerminateEmployeeModal({
  showModal,
  setShowModal,
  employeeFullName,
  employeeId,
}: TerminateEmployeeModalProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();

  const handleTerminate = async () => {
    try {
      await employeeAPI.terminateEmpById(employeeId);
      messageApi.success("Employee terminated");
      navigate("/admin/employees");
    } catch (error) {
      console.error("Error terminating employee:", error);
      messageApi.error("Something went wrong - Employee ID not found");
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Warning!</h2>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={650}
        styles={{
          header: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 40,
            background: "#F5F5F4", // warmstone-100 equivalent
            borderBottom: "none",
          },
          body: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 16,
            paddingBottom: 24,
          },
          footer: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingBottom: 40,
            borderTop: "none",
          },
        }}
        footer={[
          <div className="flex gap-2 w-full" key="footer">
            <Button className="w-full" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button className="w-full" type="primary" danger onClick={handleTerminate}>
              Terminate
            </Button>
          </div>,
        ]}
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-red-600 font-bold text-2xl">
            You're about to delete {employeeFullName}.
          </h2>
          <p className="text-zinc-500 text-sm">
            All associated records (performance reviews, leave requests, and balances) will also be
            deleted. Equipment items will be unlinked, and not deleted. The user's account will
            remain, but access to this management system will be revoked.
          </p>
        </div>
      </Modal>
    </>
  );
}

export default TerminateEmployeeModal;
