import React from "react";
import { Modal, Button, message } from "antd";
import { Icons } from "../../constants/icons";
import { meetingAPI } from "../../services/api.service";
import { MeetingDTO } from "../../interfaces/meetings/meetingDTO";
import dayjs from "dayjs";

interface DeleteMeetingModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  meeting: MeetingDTO | null;
  onDeleteSuccess?: () => void;
}

function DeleteMeetingModal({
  showModal,
  setShowModal,
  meeting,
  onDeleteSuccess,
}: DeleteMeetingModalProps) {
  const [messageApi, contextHolder] = message.useMessage();

  if (!meeting) return null;

  // Handle the deletion of the equipment item
  const handleDelete = async () => {
    try {
      await meetingAPI.deleteMeeting(meeting.meetingId);
      messageApi.success(`Your meeting with ${meeting.employeeName} was deleted successfully`);
      onDeleteSuccess?.();
      setShowModal(false);
    } catch (error) {
      messageApi.error("Something went wrong and the equipment was not deleted.");
      console.error("Error deleting equipment:", error);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-red-600 font-bold text-3xl text-center">Delete Meeting?</h2>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={600}
        styles={{
          header: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 40,
            background: "#F5F5F4", // warmstone-100 equivalent
            borderBottom: "none",
          },
          body: {
            paddingLeft: 40,
            paddingRight: 40,
          },
          footer: {
            paddingLeft: 40,
            paddingRight: 40,
            paddingBottom: 40,
            borderTop: "none",
          },
        }}
        footer={[
          <div className="flex gap-2 w-full" key="footer">
            <Button key="cancel" onClick={() => setShowModal(false)} className="w-full">
              Cancel
            </Button>
            <Button key="delete" type="primary" danger onClick={handleDelete} className="w-full">
              Delete Meeting
            </Button>
          </div>,
        ]}
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center justify-center">
            <Icons.Schedule className="text-zinc-500 text-sm" />
            <p className="text-zinc-500 text-sm">
              {dayjs(meeting.startDate).format("DD MMMM YYYY")}
            </p>
            <p className="text-zinc-500 text-sm">•</p>
            <div className="flex gap-1 items-center justify-center">
              <p className="text-zinc-500 text-sm">{dayjs(meeting.startDate).format("hh:mm a")}</p>
              <p className="text-zinc-500 text-sm">-</p>
              <p className="text-zinc-500 text-sm">{dayjs(meeting.endDate).format("hh:mm a")}</p>
            </div>
          </div>
          {meeting.isOnline ? (
            <div className="flex gap-2 items-center justify-center">
              <Icons.Language className="text-zinc-500 text-sm" />
              <p className="text-zinc-500 text-sm">{meeting.meetLink}</p>
            </div>
          ) : (
            <div className="flex gap-2 items-center justify-center">
              <Icons.Place className="text-zinc-500 text-sm" />
              <p className="text-zinc-500 text-sm">{meeting.meetLocation}</p>
            </div>
          )}
          <div className="flex flex-col px-4 py-3 bg-warmstone-300 rounded-xl my-2">
            <p className="text-zinc-900 font-bold">{meeting.employeeName}</p>
            <p className="text-zinc-500 text-sm">{meeting.purpose}</p>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default DeleteMeetingModal;
