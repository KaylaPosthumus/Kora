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
  Rate,
  Upload,
  Switch,
  Spin,
  Avatar,
} from "antd";
import dayjs from "dayjs";
import CoriBtn from "../buttons/CoriBtn";
import TextArea from "antd/es/input/TextArea";
import { Icons } from "../../constants/icons";
import { AdminUser } from "../../interfaces/people/adminUser";
import { MeetingRequestCreate } from "../../interfaces/meetings/meetingRequestCreate";
import { MeetingRequestUpdate } from "../../interfaces/meetings/meetingRequestUpdate";
import { adminAPI, meetingAPI } from "../../services/api.service";
import { Gathering } from "../../interfaces/gathering/gathering";
import { MeetingRequestCard } from "../../interfaces/meetings/meetingRequestCard";
import { MeetingSchedule } from "../../interfaces/meetings/meetingSchedule";

interface AcceptScheduleMeetingModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSubmitSuccess: () => void;
  meetingRequest: MeetingRequestCard | null;
}

function AcceptScheduleMeetingModal({
  showModal,
  setShowModal,
  onSubmitSuccess,
  meetingRequest,
}: AcceptScheduleMeetingModalProps) {
  interface MeetingScheduleForm extends MeetingSchedule {
    startTime: [dayjs.Dayjs, dayjs.Dayjs];
  }

  const [form] = Form.useForm<MeetingScheduleForm>();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Handle the submission of the meeting schedule
  const handleSubmit = async () => {
    try {
      // Validate the form fields
      const values = await form.validateFields();

      // Get the start and end times from the TimePicker.RangePicker
      const [startTime, endTime] = values.startTime;

      // Combine the date with start and end times
      const startDate = dayjs(values.startDate)
        .hour(startTime.hour())
        .minute(startTime.minute())
        .second(0)
        .toISOString();

      const endDate = dayjs(values.startDate)
        .hour(endTime.hour())
        .minute(endTime.minute())
        .second(0)
        .toISOString();

      // Setup the meeting schedule object
      const meetingSchedule: MeetingSchedule = {
        isOnline: values.isOnline,
        meetLocation: values.isOnline ? null : values.meetLocation,
        meetLink: values.isOnline ? values.meetLink : null,
        startDate,
        endDate,
      };

      // Submit the meeting schedule
      if (meetingRequest) {
        await meetingAPI.confirmAndScheduleMeeting(meetingRequest.meetingId, meetingSchedule);
        await meetingAPI.updateMeeting(meetingRequest.meetingId, meetingSchedule);
        messageApi.success("Meeting was scheduled successfully");
      } else {
        messageApi.error("Error: The meeting request was not provided.");
        return;
      }

      // Reset form and close modal
      form.resetFields();
      setShowModal(false);
      setIsOnline(false);

      // Notify parent of success
      onSubmitSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        messageApi.error("Please fill out all fields correctly.");
        return;
      }
      messageApi.error("Error: The meeting was not scheduled.");
      console.error("Error scheduling meeting:", error);
    }
  };

  // Handle the cancellation of the meeting schedule
  const handleCancel = () => {
    setShowModal(false);
    setIsOnline(false);
    form.resetFields(); // Clear the form fields
  };

  if (loading) {
    return <Spin />;
  }

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <>
            <h2 className="text-zinc-900 font-bold text-3xl text-center">Schedule a Meeting</h2>
            <div className="flex flex-col items-center justify-between w-full bg-warmstone-50 p-4 rounded-2xl mt-4">
              <p className="text-zinc-500 font-normal text-sm">{meetingRequest?.purpose}</p>
              <div className="flex gap-2 items-center justify-center w-full mt-4">
                {meetingRequest?.profilePicture ? (
                  <Avatar src={meetingRequest?.profilePicture} size={32} />
                ) : (
                  <Avatar icon={<Icons.Person fontSize="small" />} size={32} />
                )}
                <p className="text-zinc-800 font-normal text-sm">{meetingRequest?.employeeName}</p>
              </div>
            </div>
          </>
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
            Schedule Meeting
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled" className="flex flex-col">
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

          {/* If meeting is in person, show the physical location field */}
          {!isOnline && (
            <Form.Item
              name="meetLocation"
              label="Physical Location"
              rules={[{ required: true, message: "Please enter a physical location" }]}
            >
              <Input type="text" />
            </Form.Item>
          )}

          {/* If meeting is online, show the meeting url field */}
          {isOnline && (
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
      </Modal>
    </>
  );
}

export default AcceptScheduleMeetingModal;
