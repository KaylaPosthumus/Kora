import React from "react";
import { Modal, Button, message } from "antd";
import { Icons } from "../../constants/icons";
import { performanceReviewsAPI } from "../../services/api.service";
import { PerformanceReviewDTO } from "../modals/EditPRModal";
import dayjs from "dayjs";

interface DeletePRModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  performanceReview: PerformanceReviewDTO | null;
  onDeleteSuccess?: () => void;
}

function DeletePRModal({
  showModal,
  setShowModal,
  performanceReview,
  onDeleteSuccess,
}: DeletePRModalProps) {
  const [messageApi, contextHolder] = message.useMessage();

  if (!performanceReview) return null;

  // Handle the deletion of the performance review
  const handleDelete = async () => {
    try {
      await performanceReviewsAPI.deletePerformanceReview(performanceReview.reviewId);
      messageApi.success(
        `Performance review for ${performanceReview.employeeName} was deleted successfully`
      );
      onDeleteSuccess?.();
      setShowModal(false);
    } catch (error) {
      messageApi.error("Something went wrong and the performance review was not deleted.");
      console.error("Error deleting performance review:", error);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <h2 className="text-red-600 font-bold text-3xl text-center">
            Delete Performance Review?
          </h2>
        }
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
              Delete Review
            </Button>
          </div>,
        ]}
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center justify-center">
            <Icons.Schedule className="text-zinc-500 text-sm" />
            <p className="text-zinc-500 text-sm">
              {dayjs(performanceReview.startDate).format("DD MMMM YYYY")}
            </p>
            <p className="text-zinc-500 text-sm">•</p>
            <div className="flex gap-1 items-center justify-center">
              <p className="text-zinc-500 text-sm">
                {dayjs(performanceReview.startDate).format("hh:mm a")}
              </p>
              <p className="text-zinc-500 text-sm">-</p>
              <p className="text-zinc-500 text-sm">
                {dayjs(performanceReview.endDate).format("hh:mm a")}
              </p>
            </div>
          </div>
          {performanceReview.isOnline ? (
            <div className="flex gap-2 items-center justify-center">
              <Icons.Language className="text-zinc-500 text-sm" />
              <p className="text-zinc-500 text-sm">{performanceReview.meetLink}</p>
            </div>
          ) : (
            <div className="flex gap-2 items-center justify-center">
              <Icons.Place className="text-zinc-500 text-sm" />
              <p className="text-zinc-500 text-sm">{performanceReview.meetLocation}</p>
            </div>
          )}
          <div className="flex flex-col w-full mt-8">
            <div className="flex items-center justify-between px-2">
              <p className="text-zinc-800 text-lg font-bold">{performanceReview.employeeName}</p>
              {performanceReview.rating && (
                <div className="flex gap-1 items-center justify-center">
                  <Icons.StarRounded className="text-amber-300 text-sm" />
                  <p className="text-zinc-500 text-sm">{performanceReview.rating} Star Rating</p>
                </div>
              )}

              {performanceReview.docUrl && (
                <div className="flex gap-1 items-center justify-center">
                  <Icons.TextSnippet className="text-zinc-500 text-sm" />
                  <p className="text-zinc-500 text-sm">PDF Attached</p>
                </div>
              )}
            </div>
            {performanceReview.comment && (
              <div className="flex px-4 py-3 bg-warmstone-300 rounded-xl my-2 w-full items-center justify-center">
                <div className="flex gap-2 items-center justify-center">
                  <p className="text-zinc-500 text-sm mt-1">{performanceReview.comment}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

export default DeletePRModal;
