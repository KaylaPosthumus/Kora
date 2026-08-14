import React, { useEffect } from "react";
import { Modal, Button, Form, Input, Select, DatePicker, message, Tooltip } from "antd";
import dayjs from "dayjs";
import { Gender, EmployType, PayCycle } from "../../types/common";
import { empUserAPI } from "../../services/api.service";

interface AdminEditEmpDetailsModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employee: {
    employeeId: string;
    fullName: string;
    googleId: string | null;
    gender: Gender;
    dateOfBirth: string;
    phoneNumber: string;
    jobTitle: string;
    department: string;
    employType: EmployType;
    employDate: string;
    salaryAmount: number;
    payCycle: PayCycle;
  } | null;
  onUpdate?: () => void; // Callback function after successful update
}

function AdminEditEmpDetailsModal({
  showModal,
  setShowModal,
  employee,
  onUpdate,
}: AdminEditEmpDetailsModalProps) {
  const [form] = Form.useForm();

  // Message System
  const [messageApi, contextHolder] = message.useMessage();

  // Update form values when employee data changes
  useEffect(() => {
    if (employee) {
      form.setFieldsValue({
        fullName: employee.fullName,
        gender: employee.gender,
        dob: dayjs(employee.dateOfBirth),
        phoneNumber: employee.phoneNumber,
        jobTitle: employee.jobTitle,
        department: employee.department,
        employType: employee.employType,
        employDate: dayjs(employee.employDate),
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
        fullName: values.fullName,
        gender: values.gender,
        dateOfBirth: values.dob.format("YYYY-MM-DD"),
        phoneNumber: values.phoneNumber,
        jobTitle: values.jobTitle,
        department: values.department,
        employType: values.employType,
        employDate: values.employDate.format("YYYY-MM-DD"),
        salaryAmount: values.salaryAmount,
        payCycle: values.payCycle,
      };

      // Update the employee details
      await empUserAPI.updateEmpUserById(employee.employeeId, updateData);

      // Success message if the update was successful
      messageApi.success("Details updated successfully");

      // Refresh the employee details
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error updating employee details:", error);
      messageApi.error("Error updating employee details");
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
        fullName: employee.fullName,
        gender: employee.gender,
        dob: dayjs(employee.dateOfBirth),
        phoneNumber: employee.phoneNumber,
        jobTitle: employee.jobTitle,
        department: employee.department,
        employType: employee.employType,
        employDate: dayjs(employee.employDate),
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
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit {employee?.fullName}</h2>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={1200}
        styles={{
          header: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 40,
          },
          body: {
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
          <Button key="update" type="primary" onClick={handleSubmit}>
            Update Info
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled" className="flex gap-4">
          {/* Personal Details */}
          <div className="flex flex-col w-full">
            <h2 className="text-zinc-500 font-bold mb-3">Personal Details</h2>
            {/* If not google user (name editable) */}
            {employee?.googleId === null ? (
              <Form.Item
                name="fullName"
                label="Name"
                rules={[{ required: true, message: "Please enter a name" }]}
              >
                <Input type="text" />
              </Form.Item>
            ) : (
              // If google user (name NOT editable)
              <div className="relative">
                <Tooltip title="Since this employee signed up with Google, their name cannot be changed.">
                  <div>
                    <Form.Item
                      name="fullName"
                      label="Name"
                      rules={[{ required: true, message: "Please enter a name" }]}
                    >
                      <Input type="text" disabled={employee?.googleId !== null} />
                    </Form.Item>
                  </div>
                </Tooltip>
              </div>
            )}
            <Form.Item
              name="gender"
              label="Gender"
              rules={[{ required: true, message: "Please select a gender" }]}
            >
              <Select>
                <Select.Option value={Gender.Male}>Male</Select.Option>
                <Select.Option value={Gender.Female}>Female</Select.Option>
                <Select.Option value={Gender.Other}>Other</Select.Option>
              </Select>
            </Form.Item>
            {/* Date of Birth */}
            <Form.Item
              name="dob"
              label="Date of Birth"
              rules={[{ required: true, message: "Please select a date of birth" }]}
            >
              <DatePicker className="w-full h-12" />
            </Form.Item>
            {/* Phone Number */}
            <Form.Item
              name="phoneNumber"
              label="Phone Number"
              rules={[
                { required: true, message: "Please enter a phone number" },
                { pattern: /^[0-9+\-() ]+$/, message: "Please enter a valid phone number" },
              ]}
            >
              <Input type="text" />
            </Form.Item>
          </div>
          {/* Employment Details */}
          <div className="flex flex-col w-full">
            <h2 className="text-zinc-500 font-bold mb-3">Employment</h2>
            <Form.Item
              label="Job Title"
              name="jobTitle"
              rules={[{ required: true, message: "Please enter a job title" }]}
            >
              <Input type="text" />
            </Form.Item>
            <Form.Item
              label="Department"
              name="department"
              rules={[{ required: true, message: "Please enter a department" }]}
            >
              <Input type="text" />
            </Form.Item>
            <Form.Item name="employType" label="Employment Type">
              <Select>
                <Select.Option value={EmployType.FullTime}>Full-Time</Select.Option>
                <Select.Option value={EmployType.PartTime}>Part-Time</Select.Option>
                <Select.Option value={EmployType.Contract}>Contractor</Select.Option>
                <Select.Option value={EmployType.Intern}>Intern</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="employDate"
              label="Date of Employment"
              rules={[{ required: true, message: "Please select a date of employment" }]}
            >
              <DatePicker className="w-full h-12" />
            </Form.Item>
          </div>
          {/* Payroll Details */}
          <div className="flex flex-col w-full">
            <h2 className="text-zinc-500 font-bold mb-3">Payroll</h2>
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
          </div>
        </Form>
      </Modal>
    </>
  );
}

export default AdminEditEmpDetailsModal;
