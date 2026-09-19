import React from "react";
import { Modal, Button, message } from "antd";
import { Icons } from "../../constants/icons";
import { EquipmentConditionLabels } from "@/shared/types/common";
import { equipmentAPI } from "../../services/api.service";
import EquipmentTypeAvatar from "../avatars/EquipmentTypeAvatar";
import { Equipment } from "@/shared/types/equipment";

interface UnlinkEquipmentModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  equipment: Equipment | null;
  onUnlinkSuccess: () => void;
}

function UnlinkEquipmentModal({
  showModal,
  setShowModal,
  equipment,
  onUnlinkSuccess,
}: UnlinkEquipmentModalProps) {
  const [messageApi, contextHolder] = message.useMessage();

  if (!equipment) return null;

  // Handle the unlinking of the equipment item
  const handleUnlink = async () => {
    try {
      await equipmentAPI.unlinkEquipItemFromEmp(equipment.equipmentId);
      messageApi.success(`${equipment.equipmentName} was unlinked successfully`);
      onUnlinkSuccess();
      setShowModal(false);
    } catch (error) {
      messageApi.error("Something went wrong and the equipment was not unlinked.");
      console.error("Error unlinking equipment:", error);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-orange-400 font-bold text-3xl text-center">Unlink Item?</h2>}
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
            <Button key="unlink" type="primary" onClick={handleUnlink} className="w-full">
              Unlink Item
            </Button>
          </div>,
        ]}
      >
        <div className="flex flex-col gap-2">
          <p className="text-zinc-500 text-sm text-center">
            This will remove the item from the employee's profile, but not delete it. You can relink
            this item later.
          </p>
          <div className="flex items-center gap-3 px-4 py-3 bg-warmstone-300 rounded-xl my-2">
            <EquipmentTypeAvatar equipmentCategoryId={equipment.equipmentCatId} />
            <div className="flex flex-col">
              <p className="text-zinc-900">{equipment.equipmentName}</p>
              <div className="flex items-center gap-2">
                <p className="text-zinc-500 text-sm">{equipment.equipmentCategoryName}</p>
                <p className="text-zinc-500 text-sm">•</p>
                <p className="text-zinc-500 text-sm">
                  {EquipmentConditionLabels[equipment.condition]}{" "}
                  Condition
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default UnlinkEquipmentModal;
