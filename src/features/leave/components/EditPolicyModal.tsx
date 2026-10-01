import React from "react";
import { Modal, Button, Form, message } from "antd";
import TextArea from "antd/es/input/TextArea";

interface EditPolicyModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
}

const DEFAULT_POLICY = `Employees must submit leave requests in advance for approval. Leave is subject to company policies and availability.
Unauthorized absences may impact benefits. Check your balance before applying.`;

const EditPolicyModal: React.FC<EditPolicyModalProps> = ({ showModal, setShowModal }) => {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async () => {
    try {
      const { policyText } = await form.validateFields();
      localStorage.setItem("leavePolicy", policyText);
      messageApi.success("Policy updated successfully");
      setShowModal(false);
      form.resetFields();
    } catch {
      // validation errors handled by Form.Item
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
          initialValues={{
            policyText: localStorage.getItem("leavePolicy") || DEFAULT_POLICY,
          }}
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
