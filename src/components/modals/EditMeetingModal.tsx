import React, { useState, useEffect } from "react";
import { meetingAPI } from "../../services/api.service";
import { Modal, Button, Form, message, Switch, DatePicker, TimePicker } from "antd";
import dayjs from "dayjs";
import { Icons } from "../../constants/icons";
import { MeetingDTO } from "../../interfaces/meetings/meetingDTO";
import { MeetStatus } from "../../types/common";

interface EditMeetingModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onEditSuccess: () => void;
  meeting?: MeetingDTO;
}

function EditMeetingModal({
  showModal,
  setShowModal,
  onEditSuccess,
  meeting,
}: EditMeetingModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [isOnline, setIsOnline] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Initialize form values when the modal is opened
  useEffect(() => {
    if (showModal && meeting) {
      setIsOnline(meeting.isOnline);
      setIsCompleted(meeting.status === MeetStatus.Completed);

      // Convert dates to dayjs objects for form fields
      const startDateTime = dayjs(meeting.startDate);
      const endDateTime = dayjs(meeting.endDate);

      // Time values need to be in an array for TimePicker.RangePicker
      const timeRange = [startDateTime, endDateTime];

      form.setFieldsValue({
        meetingId: meeting.meetingId,
        isOnline: meeting.isOnline,
        meetLocation: meeting.meetLocation,
        meetLink: meeting.meetLink,
        meetingDate: startDateTime,
        timeRange: timeRange,
        status: meeting.status,
        completedStatus: meeting.status === MeetStatus.Completed,
      });
    }
  }, [showModal, meeting, form]);

  // Handle switch toggle for online/in-person
  const handleOnlineChange = (checked: boolean) => {
    setIsOnline(checked);
    form.setFieldsValue({ isOnline: checked });

    // Clear the opposite field when switching
    if (checked) {
      form.setFieldsValue({ meetLocation: "" });
    } else {
      form.setFieldsValue({ meetLink: "" });
    }
  };

  // Handle switch toggle for meeting status
  const handleCompletedChange = (checked: boolean) => {
    setIsCompleted(checked);
    // Set the appropriate MeetStatus enum value based on the switch state
    const statusValue = checked ? MeetStatus.Completed : MeetStatus.Upcoming;
    form.setFieldsValue({ completedStatus: checked, status: statusValue });
  };

  // Handle the editing of the meeting
  const handleEdit = async () => {
    try {
      // Validate the form fields
      const values = await form.validateFields();

      if (!meeting) {
        messageApi.error("No meeting selected");
        return;
      }

      // Get the status directly from form values instead of the component state
      const newStatus = values.completedStatus ? MeetStatus.Completed : MeetStatus.Upcoming;

      // Process date and time
      const meetingDate = values.meetingDate;
      const [startTime, endTime] = values.timeRange || [
        dayjs(meeting.startDate),
        dayjs(meeting.endDate),
      ];

      // Combine date and time
      const fullStartDate = meetingDate
        ? meetingDate.hour(startTime.hour()).minute(startTime.minute()).second(0).toISOString()
        : meeting.startDate;

      const fullEndDate = meetingDate
        ? meetingDate.hour(endTime.hour()).minute(endTime.minute()).second(0).toISOString()
        : meeting.endDate;

      const updatedValues = {
        isOnline: values.isOnline,
        meetLocation: values.isOnline ? "" : values.meetLocation || "",
        meetLink: values.isOnline ? values.meetLink || "" : "",
        startDate: fullStartDate,
        endDate: fullEndDate,
        status: newStatus,
      };

      try {
        // Call the update API with meetingId and updatedValues
        await meetingAPI.updateMeeting(meeting.meetingId, updatedValues);

        messageApi.success("Meeting was updated successfully");

        // Reset form and close modal
        form.resetFields();
        setShowModal(false);

        // Notify parent of success
        onEditSuccess();
      } catch (apiError: any) {
        messageApi.error("The meeting was not updated.");
      }
    } catch (error: any) {
      messageApi.error("Please fill out all fields correctly.");
    }
  };

  // Handle the cancellation of the meeting edit
  const handleCancel = () => {
    setShowModal(false);
    form.resetFields(); // Clear the form fields
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit Meeting</h2>}
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
          <Button key="edit" type="primary" onClick={handleEdit}>
            Update Meeting
          </Button>,
        ]}
      >
        {meeting && (
          <div className="mb-6">
            <div className="text-zinc-800 text-lg font-semibold">{meeting.employeeName}</div>
          </div>
        )}

        <Form form={form} layout="vertical" variant="filled" className="flex flex-col">
          <Form.Item
            name="meetingDate"
            label="Meeting Date"
            rules={[{ required: true, message: "Please select a date for the meeting." }]}
          >
            <DatePicker
              className="w-full h-12"
              format="DD MMM YYYY" // Prettier format
            />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="Meeting Time"
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

          <Form.Item name="isOnline" valuePropName="checked" hidden>
            {/* This hidden field tracks the isOnline value */}
          </Form.Item>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-zinc-500 text-[12px]">Meeting is online?</p>
            <Switch
              checked={isOnline}
              checkedChildren="Yes"
              unCheckedChildren="No"
              onChange={handleOnlineChange}
            />
          </div>

          {isOnline ? (
            <Form.Item
              name="meetLink"
              label="Meeting Link"
              rules={[{ required: isOnline, message: "Please enter the meeting link." }]}
            >
              <input
                type="text"
                placeholder="Enter meeting link"
                className="w-full h-12 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-corigreen-500 focus:border-transparent"
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="meetLocation"
              label="Meeting Location"
              rules={[{ required: !isOnline, message: "Please enter the meeting location." }]}
            >
              <input
                type="text"
                placeholder="Enter meeting location"
                className="w-full h-12 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-corigreen-500 focus:border-transparent"
              />
            </Form.Item>
          )}

          <Form.Item name="status" hidden>
            {/* This hidden field stores the actual MeetStatus enum value */}
          </Form.Item>
          <Form.Item name="completedStatus" valuePropName="checked" hidden>
            {/* This hidden field tracks the completed status checkbox */}
          </Form.Item>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-zinc-500 text-[12px]">Meeting is completed?</p>
            <Switch
              checked={isCompleted}
              checkedChildren="Yes"
              unCheckedChildren="No"
              onChange={handleCompletedChange}
            />
          </div>
        </Form>
      </Modal>
    </>
  );
}

export default EditMeetingModal;
