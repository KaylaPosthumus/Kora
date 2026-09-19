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
  Spin,
  Alert,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import KoraBtn from "../buttons/KoraBtn";
import { empUserAPI } from "../../services/api.service";
import { EmployType, Gender, PayCycle, UserRole } from "@/shared/types/common";
import { Icons } from "../../constants/icons";
import GoogleIcon from "../../assets/icons/googleIcon.png";
import { getFullImageUrl } from "../../utils/imageUtils";

//Functionality
import { performanceReviewsAPI } from "../../services/api.service";

interface CreatePRModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onCreateSuccess: () => void;
  adminId: string;
}

// Employee options from dropdown
interface EmployeeOption {
  userId: string;
  fullName: string;
  email: string;
  googleId: string | null;
  profilePicture: string | null;
  role: UserRole;
  employeeId: string;
  gender: Gender;
  dateOfBirth: string;
  phoneNumber: string;
  jobTitle: string;
  department: string;
  salaryAmount: number;
  payCycle: PayCycle;
  lastPaidDate: string | null;
  employType: EmployType;
  employDate: string;
  isSuspended: boolean;
}

function CreatePRModal({ showModal, setShowModal, onCreateSuccess, adminId }: CreatePRModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [isOnline, setIsOnline] = useState(false);
  const [dropdownEmployees, setDropdownEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [selectedEmpUser, setSelectedEmpUser] = useState<EmployeeOption | null>(null);

  // Fetch emp users for dropdown
  const fetchEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      const res = await empUserAPI.getAllEmpUsers();
      setDropdownEmployees(res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
      messageApi.error("Failed to load employees");
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  // On modal open, fetch employees
  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmpUser) {
      console.log(selectedEmpUser);
    }
  }, [selectedEmpUser]);

  // Reset selectedEmployeeId when modal is closed/opened
  useEffect(() => {
    if (!showModal) {
      setSelectedEmpUser(null);
    }
  }, [showModal]);

  // Format the employee data for the dropdown
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
            <p className="text-zinc-500 text-sm">{emp.jobTitle}</p>
          </div>
        </div>
        {emp.isSuspended && (
          <div className="flex items-center gap-2">
            <Icons.Warning className="text-red-400" fontSize="small" />
            <p className="text-red-400 text-sm">Suspended</p>
          </div>
        )}
        {/* Show Google icon if employee is not suspended and has a google id */}
        {emp.googleId !== null && !emp.isSuspended && (
          <div className="flex items-center gap-2">
            <img src={GoogleIcon} alt="Google" className="w-5 h-5" />
            <p className="text-blue-400 text-sm">Google User</p>
          </div>
        )}
      </div>
    ),
    data: emp,
  }));

  // Handle the creation of the performance review
  const handleCreate = async () => {
    // Check if adminId is valid before proceeding
    if (!adminId) {
      messageApi.error("Admin ID not available. Please try again.");
      return;
    }

    try {
      const values = await form.validateFields();

      // Combine date and time range into start and end datetime
      const startDate = values.startDate;
      const [startTime, endTime] = values.startTime;

      const fullStartDate = dayjs(startDate)
        .hour(startTime.hour())
        .minute(startTime.minute())
        .second(0)
        .toISOString();

      const fullEndDate = dayjs(startDate)
        .hour(endTime.hour())
        .minute(endTime.minute())
        .second(0)
        .toISOString();

      const payload = {
        adminId: adminId,
        employeeId: values.employeeId,
        isOnline: values.isOnline,
        meetLocation: values.meetLocation || null,
        meetLink: values.meetLink || null,
        startDate: fullStartDate,
        endDate: fullEndDate,
        rating: null,
        comment: null,
        docUrl: null,
      };

      await performanceReviewsAPI.CreatePerformanceReview(payload);

      messageApi.success("Performance review created successfully");

      // Reset form and close modal
      form.resetFields();
      setShowModal(false);
      onCreateSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        messageApi.error("Please fill out all fields correctly.");
        return;
      }
      console.error("Error creating performance review:", error);
      messageApi.error("Error: The performance review was not created.");
    }
  };

  // Handle the cancellation of the performance review creation
  const handleCancel = () => {
    setShowModal(false);
    form.resetFields(); // Clear the form fields
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Create a Review Meeting</h2>}
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
          <Button key="create" type="primary" onClick={handleCreate}>
            Create Meeting
          </Button>,
        ]}
      >
        <Spin spinning={isLoadingEmployees}>
          <Form
            form={form}
            layout="vertical"
            variant="filled"
            className="flex flex-col"
            onValuesChange={(changedValues) => {
              // When form values change, and employee is set, set the selected employee
              if (changedValues.employeeId !== undefined) {
                setSelectedEmpUser(
                  dropdownEmployees.find((e) => e.employeeId === changedValues.employeeId) || null
                );
              }
            }}
          >
            <Form.Item
              name="startDate"
              label="Meeting Date"
              rules={[{ required: true, message: "Please select a date for the meeting." }]}
            >
              <DatePicker
                className="w-full h-12"
                minDate={dayjs()} // Start from today
                maxDate={dayjs().add(3, "month")} // Max 3 months from today
                format="DD MMM YYYY" // Prettier format
              />
            </Form.Item>
            <Form.Item
              name="startTime"
              label="Start Time"
              rules={[{ required: true, message: "Please select a time for the meeting." }]}
            >
              <TimePicker.RangePicker
                className="w-full h-12"
                format="HH:mm"
                minuteStep={5} // 5 minute increments
                showNow={true}
                disabledTime={() => ({
                  // Only allow times between 4am and 9pm
                  disabledHours: () => [0, 1, 2, 3, 21, 22, 23],
                })}
                hideDisabledOptions={true} // Hide the disabled options
              />
            </Form.Item>
            <Form.Item
              name="employeeId"
              label="Employee"
              rules={[{ required: true, message: "Please select an employee" }]}
            >
              <Select
                options={employeeOptions}
                optionFilterProp="label"
                labelRender={(option) => {
                  const emp = dropdownEmployees.find((e) => e.employeeId === option.value);
                  return <div>{emp?.fullName}</div>;
                }}
                loading={isLoadingEmployees}
                showSearch
                allowClear
              ></Select>
            </Form.Item>

            {/* If employee is suspended, show the alert */}
            {selectedEmpUser?.isSuspended && (
              <Alert
                message={`Take Note: Selected employee is suspended.`}
                type="warning"
                showIcon
                className="mb-4"
                closable
              />
            )}

            <Form.Item
              name="isOnline"
              label="Meeting Type"
              initialValue={false}
              rules={[{ required: true, message: "Please select a meeting type" }]}
            >
              <Select onChange={(value) => setIsOnline(value)} allowClear={false}>
                <Select.Option value={false}>In Person</Select.Option>
                <Select.Option value={true}>Online</Select.Option>
              </Select>
            </Form.Item>
            {/* If employee's googleId is null and meeting is online, show the alert */}
            {selectedEmpUser?.googleId === null && isOnline === true && (
              <Alert
                message={`Please Note: The selected employee doesn't have a Google account, and won't be able to join a Google Meet. Either select in-person meeting or use a different meeting platform.`}
                type="info"
                showIcon
                className="mb-4"
                closable
              />
            )}
            {/* If meeting is in person, show the physical location field */}
            {isOnline === false && (
              <Form.Item
                name="meetLocation"
                label="Physical Location"
                rules={[{ required: true, message: "Please enter a physical location" }]}
              >
                <Input type="text" />
              </Form.Item>
            )}

            {/* If meeting is online, show the meeting url field */}
            {isOnline === true && (
              <div>
                <Form.Item
                  name="meetLink"
                  label="Meeting URL"
                  rules={[
                    { required: true, message: "A meeting url is required for online meetings." },
                  ]}
                >
                  <Input type="text" />
                </Form.Item>
              </div>
            )}
          </Form>
        </Spin>
      </Modal>
    </>
  );
}

export default CreatePRModal;
