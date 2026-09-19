import React from "react";
import { Modal, Button, Form, Input, Select, message } from "antd";
import { equipmentAPI } from "@/services/api.service";
import { EquipmentCategory, EquipmentCondition } from "@/shared/types/common";

interface CreateUnlinkedEquipModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onCreateSuccess: () => void;
}

function CreateUnlinkedEquipModal({
  showModal,
  setShowModal,
  onCreateSuccess,
}: CreateUnlinkedEquipModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Handle the creation of the equipment item
  const handleCreate = async () => {
    try {
      // Validate the form fields
      const values = await form.validateFields();

      // Create the equipment item
      await equipmentAPI.createEquipItemOrItems([values]);
      messageApi.success("Equipment was created successfully");

      // Reset form and close modal
      form.resetFields();
      setShowModal(false);

      // Notify parent of success
      onCreateSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        messageApi.error("Please fill out all fields correctly.");
        return;
      }
      messageApi.error("Something went wrong and the equipment was not created.");
      console.error("Error creating equipment:", error);
    }
  };

  // Handle the cancellation of the equipment item creation
  const handleCancel = () => {
    setShowModal(false);
    form.resetFields(); // Clear the form fields
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Create Equipment Item</h2>}
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
            paddingTop: 20,
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
          <Button key="create" type="primary" onClick={handleCreate}>
            Create Item
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled" className="flex flex-col">
          <Form.Item
            name="equipmentName"
            label="Equipment Name"
            rules={[{ required: true, message: "Please enter the equipment name" }]}
          >
            <Input type="text" />
          </Form.Item>
          <Form.Item
            name="equipmentCatId"
            label="Equipment Category"
            rules={[{ required: true, message: "Please select an equipment category" }]}
          >
            <Select>
              <Select.Option value={EquipmentCategory.Cellphone}>Cellphone</Select.Option>
              <Select.Option value={EquipmentCategory.Tablet}>Tablet</Select.Option>
              <Select.Option value={EquipmentCategory.Laptop}>Laptop</Select.Option>
              <Select.Option value={EquipmentCategory.Monitor}>Monitor</Select.Option>
              <Select.Option value={EquipmentCategory.Headset}>Headset</Select.Option>
              <Select.Option value={EquipmentCategory.Keyboard}>Keyboard</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="condition"
            label="Condition"
            rules={[{ required: true, message: "Please select a condition" }]}
          >
            <Select>
              {/* New = 0, Good = 1, Decent = 2, Used = 3 */}
              <Select.Option value={EquipmentCondition.New}>New</Select.Option>
              <Select.Option value={EquipmentCondition.Good}>Good</Select.Option>
              <Select.Option value={EquipmentCondition.Decent}>Decent</Select.Option>
              <Select.Option value={EquipmentCondition.Used}>Used</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default CreateUnlinkedEquipModal;
