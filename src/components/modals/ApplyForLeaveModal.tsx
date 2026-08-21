import React, { useEffect, useState } from "react";

// Import API service
import { empLeaveRequestsAPI, leaveTypesAPI } from "../../services/api.service";

import dayjs from "dayjs";
import KoraBtn from "../buttons/KoraBtn";
import TextArea from "antd/es/input/TextArea";
import { Icons } from "../../constants/icons";

import {
  Modal,
  Button,
  Form,
  Select,
  message,
  DatePicker,
} from "antd";
import { getFullCurrentUser } from "../../services/authService";

interface ApplyForLeaveModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSubmitSuccess: () => void;
}

function ApplyForLeaveModal({
  showModal,
  setShowModal,
  onSubmitSuccess,
}: ApplyForLeaveModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<
    { leaveTypeId: string; leaveTypeName: string }[]
  >([]);
  const [isLoadingLeaveTypes, setIsLoadingLeaveTypes] = useState(false);

  // Load the leave types for the dropdown when the modal opens.
  useEffect(() => {
    if (!showModal) return;

    const fetchLeaveTypes = async () => {
      try {
        setIsLoadingLeaveTypes(true);
        const response = await leaveTypesAPI.getAllLeaveTypes();
        setLeaveTypes(response.data);
      } catch (error) {
        console.error("Error fetching leave types:", error);
        messageApi.error("Could not load leave types");
      } finally {
        setIsLoadingLeaveTypes(false);
      }
    };

    fetchLeaveTypes();
  }, [showModal]);

  // Handle the submission of the leave request
  const handleSubmit = async () => {
    try {
      // Disable button and show loading
      setIsSubmitting(true);

      // Validate the form fields
      const values = await form.validateFields();
      const user = await getFullCurrentUser();

      // Guard: Ensure `user` exists and has `employeeId`
      if (!user || !user.employeeId) {
        messageApi.error("Unable to identify your user account.");
        setIsSubmitting(false);
        return;
      }

      // Build payload
      const [startDate, endDate] = values.leaveDateRange;
      const payload = {
        employeeId: user.employeeId,
        leaveTypeId: values.leaveTypeId,
        startDate: dayjs(startDate).format("YYYY-MM-DD"),
        endDate: dayjs(endDate).format("YYYY-MM-DD"),
        comment: values.comment || "",
      };

      // Send to backend
      await empLeaveRequestsAPI.createLeaveRequest(payload);

      messageApi.success("Leave request was submitted successfully");

      // Reset form and close modal
      form.resetFields();
      setShowModal(false);

      // Notify parent of success
      onSubmitSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        messageApi.error("Please fill out all fields correctly.");
      } else {
        messageApi.error("Error: The leave request was not submitted.");
        console.error("Error submitting leave request:", error);
      }
    } finally {
      // Re-enable button regardless of success or failure
      setIsSubmitting(false);
    }
  };

  // Handle the cancellation of the leave request creation
  const handleCancel = () => {
    setShowModal(false);
    form.resetFields();
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <h2 className="text-zinc-900 font-bold text-3xl">Apply for Leave</h2>
        }
        open={showModal}
        onCancel={handleCancel}
        width={600}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Submit Application
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          variant="filled"
          className="flex flex-col"
        >
          <Form.Item
            name="leaveTypeId"
            label="Leave Type"
            rules={[{ required: true, message: "Please select a leave type" }]}
          >
            <Select loading={isLoadingLeaveTypes}>
              {leaveTypes.map((leaveType) => (
                <Select.Option key={leaveType.leaveTypeId} value={leaveType.leaveTypeId}>
                  {leaveType.leaveTypeName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="leaveDateRange"
            label="Leave Date"
            rules={[{ required: true, message: "Please select a leave date" }]}
          >
            <DatePicker.RangePicker
              className="w-full h-12"
              disabledDate={(current) => current && current < dayjs().startOf("day")}
              format="DD MMM YYYY"
            />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <div className="flex gap-2">
              <TextArea rows={4} />
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default ApplyForLeaveModal;
