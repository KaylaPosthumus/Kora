import React, { useEffect } from "react";
import { Modal, Button, Form, Input, Select, message } from "antd";
import { PayCycle } from "@/shared/types/common";
import { empUserAPI } from "@/features/employees/api/employeesApi";
interface AdminEditEmpPayrollModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employee: {
    employeeId: string;
    fullName: string;
    salaryAmount: number;
    payCycle: PayCycle;
  } | null;
  onUpdate?: () => void; // Callback function after successful update
}

function AdminEditEmpPayrollModal({
  showModal,
  setShowModal,
  employee,
  onUpdate,
}: AdminEditEmpPayrollModalProps) {
  const [form] = Form.useForm();

  // Message System
  const [messageApi, contextHolder] = message.useMessage();

  // Update form values when employee data changes
  useEffect(() => {
    if (employee) {
      form.setFieldsValue({
        salaryAmount: employee.salaryAmount,
        payCycle: employee.payCycle,
      });
    }
  }, [employee, form]);

  const handleSubmit = async () => {
    try {
      // Validate all form fields
      const values = await form.validateFields();

      // Check if we have an employee ID
      if (!employee?.employeeId) {
        messageApi.error("No employee ID found");
        return;
      }

      // Prepare the data to be sent
      const updateData = {
        salaryAmount: values.salaryAmount,
        payCycle: values.payCycle,
      };

      // Update the employee details
      await empUserAPI.updateEmpUserById(employee.employeeId, updateData);

      // Success message if the update was successful
      messageApi.success("Payroll details updated successfully");

      // Refresh the employee details
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error updating payroll details:", error);
      messageApi.error("Error updating payroll details");
    }
    // Close the modal
    setShowModal(false);

    // Reset the form fields
    form.resetFields();
  };

  const handleCancel = () => {
    // Reset the form values to the original values
    if (employee) {
      form.setFieldsValue({
        salaryAmount: employee.salaryAmount,
        payCycle: employee.payCycle,
      });
    }
    setShowModal(false);
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit Payroll</h2>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={500}
        styles={{
          header: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 40,
          },
          body: {
            paddingTop: 20,
            paddingLeft: 40,
            paddingRight: 40,
            paddingBottom: 40,
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
          <Button key="update" type="primary" onClick={handleSubmit}>
            Update Payroll
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled">
          {/* Payroll Details */}
          <Form.Item
            label="Salary Amount"
            name="salaryAmount"
            rules={[{ required: true, message: "Please enter a salary amount" }]}
          >
            <Input type="number" />
          </Form.Item>
          <Form.Item
            name="payCycle"
            label="Pay Cycle"
            rules={[{ required: true, message: "Please select a pay cycle" }]}
          >
            <Select>
              <Select.Option value={PayCycle.Monthly}>Monthly</Select.Option>
              <Select.Option value={PayCycle.BiWeekly}>Bi-Weekly</Select.Option>
              <Select.Option value={PayCycle.Weekly}>Weekly</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AdminEditEmpPayrollModal;
