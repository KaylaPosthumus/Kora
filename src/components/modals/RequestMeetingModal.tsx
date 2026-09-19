import React, { useEffect, useState } from "react";
import {
  Modal,
  Button,
  Form,
  Input,
  Select,
  message,
  DatePicker,
  TimePicker,
  Rate,
  Upload,
  Switch,
  Spin,
} from "antd";
import dayjs from "dayjs";
import KoraBtn from "../buttons/KoraBtn";
import TextArea from "antd/es/input/TextArea";
import { Icons } from "../../constants/icons";
import { AdminUser } from "@/shared/types/adminUser";
import { MeetingRequestCreate } from "@/shared/types/meetingRequestCreate";
import { adminAPI, meetingAPI } from "../../services/api.service";

interface RequestMeetingModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSubmitSuccess: () => void;
  employeeId: string;
}

function RequestMeetingModal({ showModal, setShowModal, onSubmitSuccess, employeeId }: RequestMeetingModalProps) {
  const [form] = Form.useForm<MeetingRequestCreate>();
  const [messageApi, contextHolder] = message.useMessage();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchAdmins = async () => {
      setLoading(true);
      const response = await adminAPI.getAllAdmins();
      setAdmins(response.data);
      setLoading(false);
    };
    fetchAdmins();
  }, []);

  // Handle the submission of the leave request
  const handleSubmit = async () => {
    // Validate the form fields
    const values = await form.validateFields();

    // Setup the meeting request object
    const meetingRequest: MeetingRequestCreate = {
      adminId: values.adminId,
      employeeId,
      purpose: values.purpose,
    };
    try {
      // Submit the meeting request
      await meetingAPI.createMeetingRequest(meetingRequest);

      messageApi.success("Meeting request was submitted successfully");

      // Reset form and close modal
      form.resetFields();
      setShowModal(false);

      // Notify parent of success
      onSubmitSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        messageApi.error("Please fill out all fields correctly.");
        return;
      }
      messageApi.error("Error: The meeting request was not submitted.");
      console.error("Error submitting meeting request:", error);
    }
  };

  // Handle the cancellation of the leave request creation
  const handleCancel = () => {
    setShowModal(false);
    form.resetFields(); // Clear the form fields
  };

  if (loading) {
    return <Spin />;
  }

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Request a Meeting</h2>}
        open={showModal}
        onCancel={handleCancel}
        width={600}
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
          <Button key="submit" type="primary" onClick={handleSubmit}>
            Make Request
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled" className="flex flex-col">
          <Form.Item
            name="adminId"
            label="Admin"
            rules={[{ required: true, message: "Please select an admin" }]}
          >
            <Select>
              {admins.map((admin) => (
                <Select.Option key={admin.adminId} value={admin.adminId}>
                  {admin.fullName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="purpose" label="Meeting Purpose">
            <div className="flex gap-2">
              <TextArea rows={4} />
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default RequestMeetingModal;
