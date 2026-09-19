import React, { useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Alert,
} from "antd";
import { equipmentAPI } from "@/features/equipment/api/equipmentApi";
import { EquipmentCategory, EquipmentCondition } from "@/shared/types/common";
import dayjs from "dayjs";

interface CreateAssignedEquipModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employee: {
    fullName: string;
    employeeId: string;
    employDate: string;
    isSuspended: boolean;
  };
  onCreate: () => void; // Callback to refresh the employee details
}

function CreateAssignedEquipModal({
  showModal,
  setShowModal,
  employee,
  onCreate,
}: CreateAssignedEquipModalProps) {
  const [form] = Form.useForm();

  // Message System
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    console.log(employee);
  }, [employee]);

  const createAssignedEquip = async () => {
    try {
      // Validate all form fields
      const values = await form.validateFields();

      // Check if we have an employee ID
      if (!employee) {
        messageApi.error("The employee was not found");
        return;
      }

      // Prepare the data to be sent (must be in an array)
      const createData = [
        {
          ...values,
          employeeId: employee.employeeId,
          assignedDate: values.assignedDate.format("YYYY-MM-DD"), // Format the date to YYYY-MM-DD
        },
      ];

      console.log(createData);

      // Create the equipment item
      await equipmentAPI.createEquipItemOrItems(createData);

      // Success message if the creation was successful
      messageApi.success("Equipment was created successfully");

      // Refresh the employee details
      if (onCreate) {
        onCreate();
      }
    } catch (error) {
      messageApi.error(
        "Something went wrong and the equipment was not created."
      );
      console.error("Error creating equipment:", error);
    }

    // Close the modal
    setShowModal(false);

    // Reset the form fields
    form.resetFields();
  };

  // Handle the cancellation of the equipment item creation
  const handleCancel = () => {
    setShowModal(false);
    form.resetFields(); // Clear the form fields
  };

  return (
    <>
      {contextHolder}
      {employee && (
        <Modal
          title={
            <h2 className="text-zinc-900 font-bold text-3xl flex flex-col gap-2">
              {/* Create Equipment for {employee.fullName} */}
              Create Equipment{" "}
              <span className="text-korablue-500 text-xl font-light">
                (assigned to {employee.fullName})
              </span>
            </h2>
          }
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
              paddingTop: 8,
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
            <Button key="create" type="primary" onClick={createAssignedEquip}>
              Create & Add
            </Button>,
          ]}
        >
          <Form
            form={form}
            layout="vertical"
            variant="filled"
            className="flex flex-col"
          >
            {employee.isSuspended && (
              <Alert
                description="This employee is suspended, please proceed with caution."
                type="warning"
                showIcon
                className="mb-4 rounded-xl"
                closable
              />
            )}
            <Form.Item
              name="equipmentName"
              label="Equipment Name"
              rules={[
                {
                  required: true,
                  message: "Please enter a name for the equipment",
                },
              ]}
            >
              <Input type="text" />
            </Form.Item>
            <Form.Item
              name="equipmentCatId"
              label="Equipment Category"
              rules={[
                {
                  required: true,
                  message: "Please select an equipment category",
                },
              ]}
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
            <Form.Item
              name="assignedDate"
              label="Assigned Date"
              rules={[
                {
                  required: true,
                  message: "Please select when the equipment was assigned",
                },
              ]}
            >
              <DatePicker
                className="w-full h-12"
                // Can't assign equipment to an employee before they were hired
                minDate={dayjs(employee.employDate, "YYYY-MM-DD")}
                // Can't assign equipment to an employee after today
                maxDate={dayjs()}
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </>
  );
}

export default CreateAssignedEquipModal;
