import React, { useEffect } from "react";
import { Modal, Button, Form, message } from "antd";
import TextArea from "antd/es/input/TextArea";
import { leavePolicyAPI } from "@/features/leave/api/leaveApi";

interface EditPolicyModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
}

const EditPolicyModal: React.FC<EditPolicyModalProps> = ({ showModal, setShowModal }) => {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!showModal) return;

    leavePolicyAPI
      .get()
      .then(({ data }) => form.setFieldsValue({ policyText: data }))
      .catch((error) => {
        console.error("Error loading the leave policy:", error);
        messageApi.error("Could not load the current policy");
      });
  }, [showModal, form, messageApi]);

  const handleSubmit = async () => {
    let policyText: string;
    try {
      ({ policyText } = await form.validateFields());
    } catch {
      // validation errors handled by Form.Item
      return;
    }

    try {
      await leavePolicyAPI.save(policyText);
      messageApi.success("Policy updated successfully");
      setShowModal(false);
      form.resetFields();
    } catch (error) {
      console.error("Error saving the leave policy:", error);
      messageApi.error("The policy was not saved. Please try again.");
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    form.resetFields();
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit Policy</h2>}
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
            Save
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
            name="policyText"
            label="Policy"
            rules={[{ required: true, message: "Please enter the policy text" }]}
          >
             <TextArea
              autoSize={{ minRows: 6 }}
              style={{ resize: "none" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default EditPolicyModal;
