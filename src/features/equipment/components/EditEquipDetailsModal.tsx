import React, { useEffect } from "react";
import { Modal, Button, Form, Input, Select, message, DatePicker } from "antd";
import { equipmentAPI } from "@/services/api.service";
import { EquipmentCategory, EquipmentCondition } from "@/shared/types/common";
import dayjs from "dayjs";
import { Equipment } from "@/shared/types/equipment";
import { EmpUser } from "@/shared/types/empUser";
interface EditEquipDetailsModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  equipment: Equipment | null;
  employeeId: string | null;
  employDate: string | null;
  onEditSuccess: () => void;
}

function EditEquipDetailsModal({
  showModal,
  setShowModal,
  equipment,
  employeeId,
  employDate,
  onEditSuccess,
}: EditEquipDetailsModalProps) {
  const [form] = Form.useForm();

  // Message System
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (equipment) {
      console.log(equipment);
      form.setFieldsValue({
        equipmentName: equipment.equipmentName,
        equipmentCatId: equipment.equipmentCatId,
        condition: equipment.condition,
        assignedDate: equipment.assignedDate ? dayjs(equipment.assignedDate) : undefined,
      });
    }
  }, [equipment, form]);

  const handleSave = async () => {
    if (equipment) {
      try {
        const values = await form.validateFields();
        const formData = {
          ...values,
          assignedDate: values.assignedDate ? values.assignedDate.format("YYYY-MM-DD") : null,
        };
        await equipmentAPI.editEquipItemById(equipment.equipmentId, formData);
        onEditSuccess();
        setShowModal(false);
        messageApi.success("Equipment updated successfully!");
      } catch (error) {
        console.error("Error updating equipment:", error);
        messageApi.error("Failed to update equipment. Please try again.");
      }
    } else {
      messageApi.error("Equipment not found. Please select an equipment to update.");
    }
  };
  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit Equipment Item</h2>}
        open={showModal}
        onCancel={() => setShowModal(false)}
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
          <Button key="cancel" onClick={() => setShowModal(false)}>
            Cancel
          </Button>,
          <Button key="create" type="primary" onClick={handleSave}>
            Save Changes
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled" className="flex flex-col">
          <Form.Item
            name="equipmentName"
            label="Equipment Name"
            rules={[{ required: true, message: "Equipment name is required" }]}
          >
            <Input type="text" />
          </Form.Item>
          <Form.Item
            name="equipmentCatId"
            label="Equipment Category"
            rules={[{ required: true, message: "Equipment category is required" }]}
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
            rules={[{ required: true, message: "Condition is required" }]}
          >
            <Select>
              {/* New = 0, Good = 1, Decent = 2, Used = 3 */}
              <Select.Option value={EquipmentCondition.New}>New</Select.Option>
              <Select.Option value={EquipmentCondition.Good}>Good</Select.Option>
              <Select.Option value={EquipmentCondition.Decent}>Decent</Select.Option>
              <Select.Option value={EquipmentCondition.Used}>Used</Select.Option>
            </Select>
          </Form.Item>
          {employeeId && (
            <Form.Item
              name="assignedDate"
              label="Assigned Date"
              rules={[{ required: true, message: "Assigned date is required" }]}
            >
              <DatePicker
                className="w-full"
                format="DD MMM YYYY"
                allowClear={false}
                maxDate={dayjs()} // Can't assign date after today
                minDate={employDate ? dayjs(employDate) : undefined} // Can't assign date before employment date
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

export default EditEquipDetailsModal;
