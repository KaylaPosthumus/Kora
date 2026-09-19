import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Select, DatePicker, message, Spin, Alert } from "antd";
import type { SelectProps } from "antd";

import { Icons } from "@/constants/icons";
import { empUserAPI, equipmentAPI } from "@/services/api.service";
import { EquipmentCondition } from "@/shared/types/common";
import dayjs from "dayjs";
import { getFullImageUrl } from "@/utils/imageUtils";

interface AssignSingleEquipToEmpModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  equipment: {
    equipmentId: string;
    equipmentName: string;
    equipmentCategoryName: string;
    condition: EquipmentCondition;
    employeeId: string | null;
  } | null;
  onAssignSuccess: () => void; // Callback to refresh the equipment list
}

// Employee option type (for dropdown)
interface EmployeeOption {
  employeeId: string;
  fullName: string;
  profilePicture: string | null;
  isSuspended: boolean;
  numberOfItems: number;
  hasItemOfSameEquipCat: boolean;
}

function AssignSingleEquipToEmpModal({
  showModal,
  setShowModal,
  equipment,
  onAssignSuccess,
}: AssignSingleEquipToEmpModalProps) {
  const [form] = Form.useForm();
  const [dropdownEmployees, setDropdownEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Message System
  const [messageApi, contextHolder] = message.useMessage();

  // Fetch employees for the dropdown
  const fetchEmployees = async () => {
    if (equipment) {
      setIsLoadingEmployees(true);
      try {
        const res = await empUserAPI.getAllEmpUsersAndEquipStats(equipment.equipmentId);
        setDropdownEmployees(res.data);
      } catch (error) {
        console.error("Error fetching employees:", error);
        messageApi.error("Failed to load employees");
      } finally {
        setIsLoadingEmployees(false);
      }
    }
  };

  // When equipment changes, get all employees for the dropdown
  useEffect(() => {
    if (equipment) {
      setIsLoadingEmployees(true);
      fetchEmployees().finally(() => {
        // Set the initial form value if equipment has an assigned employee
        if (equipment.employeeId) {
          form.setFieldValue("empId", equipment.employeeId);
          setSelectedEmployeeId(equipment.employeeId);
        } else {
          form.resetFields(["empId"]);
          setSelectedEmployeeId(null);
        }
      });
    }
  }, [equipment]);

  // Reset selectedEmployeeId when modal is closed/opened
  useEffect(() => {
    if (!showModal) {
      setSelectedEmployeeId(null);
    }
  }, [showModal]);

  // Assignment button
  const handleAssign = () => {
    form
      .validateFields()
      .then(async (values) => {
        console.log("Form values:", values);
        console.log("Selected employee ID:", values.empId);

        if (!values.empId) {
          messageApi.error("Please select an employee");
          return;
        }

        setShowModal(false);
        setIsAssigning(true);
        try {
          if (equipment && values.empId) {
            console.log("Equipment ID:", equipment.equipmentId);
            console.log("Employee ID:", values.empId);
            await equipmentAPI.assignEquipItemOrItemsToEmp(values.empId, [equipment.equipmentId]);
            messageApi.success("Equipment assigned to employee");
            // Reset the form after successful assignment
            form.resetFields();
          } else {
            messageApi.error("Failed to assign equipment to employee");
          }
        } catch (error) {
          console.error("Error assigning equipment to employee:", error);
          messageApi.error("Failed to assign equipment to employee");
        } finally {
          setIsAssigning(false);
          onAssignSuccess();
        }
      })
      .catch((error) => {
        console.error("Form validation error:", error);
        messageApi.error("Please select an employee");
      });
  };

  // Format the employee data for the Dropdown component
  const employeeOptions = dropdownEmployees.map((emp) => ({
    value: emp.employeeId,
    label: (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {emp.profilePicture ? (
            <img
              src={getFullImageUrl(emp.profilePicture) || ""}
              alt={emp.fullName}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
              <Icons.Person className="text-zinc-400" fontSize="small" />
            </div>
          )}
          <div className="flex flex-col">
            <p className="text-zinc-900">{emp.fullName}</p>
            <p className="text-zinc-500 text-sm">
              {emp.numberOfItems} {emp.numberOfItems === 1 ? "item" : "items"}
            </p>
          </div>
        </div>
        <>
          {emp.employeeId == equipment?.employeeId ? (
            <div className="flex items-center gap-1">
              <p className="text-corigreen-500 text-[12px] font-bold">Currently Assigned</p>
            </div>
          ) : emp.isSuspended ? (
            <div className="flex items-center gap-1">
              <Icons.Warning className="text-red-500" fontSize="small" />
              <p className="text-red-500 text-[12px]">Suspended</p>
            </div>
          ) : emp.hasItemOfSameEquipCat ? (
            <div className="flex items-center gap-1">
              <Icons.Error className="text-yellow-500" fontSize="small" />
              <p className="text-zinc-500 text-[12px]">
                Already Owns A {equipment?.equipmentCategoryName}
              </p>
            </div>
          ) : null}
        </>
      </div>
    ),
    data: emp,
  }));

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Assign To Employee</h2>}
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
            paddingTop: 16,
            padding: 40,
          },
          footer: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingBottom: 40,
          },
        }}
        footer={[
          <Button key="cancel" onClick={() => setShowModal(false)} disabled={isAssigning}>
            Cancel
          </Button>,
          <Button key="create" type="primary" onClick={handleAssign} loading={isAssigning}>
            Assign To Employee
          </Button>,
        ]}
      >
        <Spin spinning={isLoadingEmployees}>
          {equipment && (
            <div className="flex items-center gap-3 px-4 py-3 bg-warmstone-300 rounded-xl mb-4">
              <div className="bg-warmstone-50 rounded-full p-2">
                <Icons.Phone className="text-zinc-900" fontSize="large" />
              </div>
              <div className="flex flex-col">
                <p className="text-zinc-900">{equipment.equipmentName}</p>
                <div className="flex items-center gap-2">
                  <p className="text-zinc-500 text-sm">{equipment.equipmentCategoryName}</p>
                  <p className="text-zinc-500 text-sm">•</p>
                  <p className="text-zinc-500 text-sm">
                    {equipment.condition === EquipmentCondition.New
                      ? "New"
                      : equipment.condition === EquipmentCondition.Good
                      ? "Good"
                      : equipment.condition === EquipmentCondition.Decent
                      ? "Decent"
                      : "Used"}{" "}
                    Condition
                  </p>
                </div>
              </div>
            </div>
          )}
          <Form
            form={form}
            layout="vertical"
            variant="filled"
            className="flex flex-col"
            onFinish={handleAssign}
            onValuesChange={(changedValues) => {
              if (changedValues.empId !== undefined) {
                setSelectedEmployeeId(changedValues.empId);
              }
            }}
          >
            <Form.Item
              name="empId"
              label="Employee"
              rules={[{ required: true, message: "Please select an employee" }]}
            >
              <Select
                placeholder="Select a Employee"
                options={employeeOptions}
                optionFilterProp="label"
                labelRender={(option) => {
                  const emp = dropdownEmployees.find((e) => e.employeeId === option.value);
                  return <div>{emp?.fullName}</div>;
                }}
                loading={isLoadingEmployees}
                showSearch
                allowClear
              />
            </Form.Item>
          </Form>
          {selectedEmployeeId && (
            <>
              {dropdownEmployees.find((emp) => emp.employeeId === selectedEmployeeId)
                ?.isSuspended ? (
                <Alert
                  description="Caution: You are assigning equipment to a suspended employee."
                  type="error"
                  showIcon
                  className="mb-4 rounded-xl"
                  closable
                />
              ) : equipment?.employeeId && equipment.employeeId !== selectedEmployeeId ? (
                <Alert
                  description={`This item is already linked to a ${
                    dropdownEmployees.find((emp) => emp.employeeId === equipment.employeeId)
                      ?.fullName
                  }. Reassigning will override the current assignment.`}
                  type="warning"
                  showIcon
                  className="mb-4 rounded-xl"
                  closable
                />
              ) : null}
            </>
          )}
        </Spin>
      </Modal>
    </>
  );
}

export default AssignSingleEquipToEmpModal;
