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
import { AdminUser } from "../../interfaces/people/adminUser";
import { MeetingRequestCreate } from "../../interfaces/meetings/meetingRequestCreate";
import { MeetingRequestUpdate } from "../../interfaces/meetings/meetingRequestUpdate";
import { adminAPI, meetingAPI } from "../../services/api.service";
import { Gathering } from "../../interfaces/gathering/gathering";
interface EditMeetingRequestModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSubmitSuccess: () => void;
  gathering: Gathering | null;
}

function EditMeetingRequestModal({ showModal, setShowModal, onSubmitSuccess, gathering }: EditMeetingRequestModalProps) {
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

  useEffect(() => {
    if (gathering) {
      console.log('Gathering data:', gathering);
      console.log('Purpose value:', gathering.purpose);
      
      const formValues = {
        adminId: gathering.adminId,
        purpose: gathering.purpose,
      };
      console.log('Setting form values:', formValues);
      
      form.setFieldsValue(formValues);
      
      // Verify form values were set
      console.log('Current form values:', form.getFieldsValue());
    }
    return () => {
      form.resetFields(); // Cleanup
    };
  }, [gathering, form]);
  // Handle the submission of the leave request
  const handleSubmit = async () => {
    console.log('Form values before submit:', form.getFieldsValue());
    // Validate the form fields
    const values = await form.validateFields();

    // Setup the meeting request object
    const updateData: MeetingRequestUpdate = {
      adminId: values.adminId,
      purpose: values.purpose,
    };

    try {
      // Edit the meeting request
      if (gathering) {
        await meetingAPI.updateMeetingRequest(gathering.id, updateData);
      } else {
        messageApi.error("Error: The meeting request id was not given.");
        return;
      }

      messageApi.success("Meeting request was updated successfully");

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
      messageApi.error("Error: The meeting request was not updated.");
      console.error("Error updating meeting request:", error);
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
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit Meeting Request</h2>}
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
            Edit Request
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

          <Form.Item 
            name="purpose" 
            label="Meeting Purpose"
            rules={[{ required: true, message: "Please enter the meeting purpose" }]}
          >
            <TextArea 
              rows={4} 
              placeholder="Enter the purpose of the meeting"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default EditMeetingRequestModal;
