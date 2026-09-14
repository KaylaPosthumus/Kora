import { ReviewStatus } from "../../types/common";
import React, { useState, useEffect } from "react";
import { performanceReviewsAPI } from "../../services/api.service";
import { Modal, Button, Form, message, Rate, Switch, DatePicker, TimePicker } from "antd";
import dayjs from "dayjs";
import TextArea from "antd/es/input/TextArea";
import { Icons } from "../../constants/icons";
import DocUploadWidget from "../uploading/DocUploadWidget";
import { downloadFileFromUrl } from "../../utils/fileUtils";

export interface PerformanceReviewDTO {
  reviewId: string;
  adminId: string;
  adminName: string;
  employeeId: string;
  employeeName: string;
  isOnline: boolean;
  meetLocation: string | null;
  meetLink: string | null;
  startDate: string;
  endDate: string;
  rating: number | null;
  comment: string | null;
  docUrl: string | null;
  status: ReviewStatus;
}

interface EditPRModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onEditSuccess: () => void;
  performanceReview?: PerformanceReviewDTO;
}

function EditPRModal({
  showModal,
  setShowModal,
  onEditSuccess,
  performanceReview,
}: EditPRModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [reviews, setReviews] = useState<PerformanceReviewDTO[]>([]);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Initialize form values when the modal is opened
  useEffect(() => {
    if (showModal && performanceReview) {
      const commentValue = performanceReview.comment || "";
      const statusValue = performanceReview.status === ReviewStatus.Completed;

      // Convert dates to dayjs objects for form fields
      const startDateTime = dayjs(performanceReview.startDate);
      const endDateTime = dayjs(performanceReview.endDate);

      // Time values need to be in an array for TimePicker.RangePicker
      const timeRange = [startDateTime, endDateTime];

      setIsCompleted(statusValue);
      setIsOnline(performanceReview.isOnline);

      form.setFieldsValue({
        reviewId: performanceReview.reviewId,
        employeeId: performanceReview.employeeId,
        rating: performanceReview.rating,
        comment: commentValue,
        docUrl: performanceReview.docUrl,
        status: statusValue,
        meetingDate: startDateTime,
        timeRange: timeRange,
        isOnline: performanceReview.isOnline,
        meetLocation: performanceReview.meetLocation,
        meetLink: performanceReview.meetLink,
      });

      setUploadedFileUrl(performanceReview.docUrl || "");
    }
  }, [showModal, performanceReview, form]);

  useEffect(() => {
    if (!performanceReview) {
      const fetchUpcoming = async () => {
        try {
          const response = await performanceReviewsAPI.GetAllUpcomingPrm();
          const reviewsArray = Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.data)
            ? response.data
            : [];
          setReviews(reviewsArray);
        } catch (error) {
          messageApi.error("Failed to fetch upcoming reviews");
          setReviews([]);
        }
      };
      fetchUpcoming();
    }
  }, [performanceReview]);

  // Handle document upload success
  const handleDocUploadSuccess = (url: string | null) => {
    setUploadedFileUrl(url || "");
    form.setFieldsValue({ docUrl: url });
  };

  // Handle document download
  const handleViewDocument = (url: string) => {
    if (!url) return;
    downloadFileFromUrl(url, messageApi);
  };

  // Handle switch toggle for completion status
  const handleSwitchChange = (checked: boolean) => {
    setIsCompleted(checked);
    form.setFieldsValue({ status: checked });
  };

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

  // Handle the editing of the performance review
  const handleEdit = async () => {
    try {
      // Validate the form fields
      const values = await form.validateFields();

      if (!performanceReview) {
        messageApi.error("No review selected");
        return;
      }

      const newStatus = isCompleted ? 2 : 1;

      // Process date and time
      const meetingDate = values.meetingDate;
      const [startTime, endTime] = values.timeRange || [
        dayjs(performanceReview.startDate),
        dayjs(performanceReview.endDate),
      ];

      // Combine date and time
      const fullStartDate = meetingDate
        ? meetingDate.hour(startTime.hour()).minute(startTime.minute()).second(0).toISOString()
        : performanceReview.startDate;

      const fullEndDate = meetingDate
        ? meetingDate.hour(endTime.hour()).minute(endTime.minute()).second(0).toISOString()
        : performanceReview.endDate;

      const updatedValues = {
        reviewId: performanceReview.reviewId,
        adminId: performanceReview.adminId,
        employeeId: performanceReview.employeeId,
        isOnline: values.isOnline,
        meetLocation: values.isOnline ? "" : values.meetLocation || "",
        meetLink: values.isOnline ? values.meetLink || "" : "",
        startDate: fullStartDate,
        endDate: fullEndDate,
        rating: values.rating || null,
        comment: values.comment || "",
        docUrl: values.docUrl || "",
        status: newStatus,
      };

      try {
        // Call the update API with reviewId and updatedValues
        await performanceReviewsAPI.UpdatePerformanceReview(updatedValues.reviewId, updatedValues);

        messageApi.success("Performance Review was edited successfully");

        // Reset form and close modal
        form.resetFields();
        setShowModal(false);

        // Notify parent of success
        onEditSuccess();
      } catch (apiError: any) {
        messageApi.error("The performance review was not updated.");
      }
    } catch (error: any) {
      messageApi.error("Please fill out all fields correctly.");
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
        title={<h2 className="text-zinc-900 font-bold text-3xl">Edit Performance Review</h2>}
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
            Update Review
          </Button>,
        ]}
      >
        {performanceReview && (
          <div className="mb-6">
            <div className="text-zinc-800 text-lg font-semibold">
              {performanceReview.employeeName}
            </div>
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

          <Form.Item name="rating" label="Rating">
            <Rate allowClear className="text-corigreen-500 text-3xl flex gap-1" />
          </Form.Item>

          <Form.Item name="comment" label="Comment">
            <TextArea rows={4} placeholder="Enter a comment" />
          </Form.Item>

          <Form.Item name="docUrl" label="Supporting Document (PDF only)">
            <DocUploadWidget
              reviewId={performanceReview?.reviewId ?? ""}
              onUploadSuccess={handleDocUploadSuccess}
              uploadedFileUrl={uploadedFileUrl}
              onViewFile={handleViewDocument}
            />
          </Form.Item>

          <Form.Item name="status" valuePropName="checked" hidden>
            {/* This hidden field is bound to the form but not visible */}
          </Form.Item>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-zinc-500 text-[12px]">Meeting is completed?</p>
            <Switch
              checked={isCompleted}
              checkedChildren="Yes"
              unCheckedChildren="No"
              onChange={handleSwitchChange}
            />
          </div>
        </Form>
      </Modal>
    </>
  );
}

export default EditPRModal;
