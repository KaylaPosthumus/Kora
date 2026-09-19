import { Equipment } from "@/shared/types/equipment";
import React, { useEffect, useState } from "react";
import { Modal, Button, Form, message } from "antd";
import { EquipmentCondition } from "@/shared/types/common";
import EquipCheckItem from "@/features/equipment/components/EquipCheckItem";
import { equipmentAPI } from "@/services/api.service";

interface AssignEquipsToExistEmpModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  employeeId: string;
  onAssignSuccess: () => void;
}

// useEffect(() => {
//   console.log(unassingedEquips);
// }, [unassingedEquips]);

// useEffect(() => {
//   console.log(selectedEquipments);
// }, [selectedEquipments]);

function AssignEquipsToExistEmpModal({
  showModal,
  setShowModal,
  employeeId,
  onAssignSuccess,
}: AssignEquipsToExistEmpModalProps) {
  const [form] = Form.useForm();
  const [unassingedEquips, setUnassingedEquips] = useState<Equipment[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);

  // Message System
  const [messageApi, contextHolder] = message.useMessage();

  // On Modal Open, load all unassigned equipment items
  useEffect(() => {
    setSelectedEquipments([]);
    fetchUnassignedEquips();
  }, [showModal]);

  // Fetch all unassigned equipment items
  const fetchUnassignedEquips = async () => {
    try {
      const response = await equipmentAPI.getAllUnassignedEquipItems();
      setUnassingedEquips(response.data);
    } catch (error) {
      messageApi.error("Error fetching unassigned equipment items");
      console.error("Error fetching unassigned equipment items:", error);
    }
  };

  // Handle Select Equipment
  const handleSelect = (id: string) => {
    setSelectedEquipments((prev) => {
      // Check if the equipment is already selected
      const isAlreadySelected = prev.includes(id);
      if (isAlreadySelected) {
        // If it is, remove it from the selected equipments
        return prev.filter((equipmentId) => equipmentId !== id);
      }
      // If not, add the id to the selected equipments
      return [...prev, id];
    });
  };

  // Handle Assign Equipment
  const handleAssign = async () => {
    // Assign 1 or multiple equipments (numbers array) to the employee
    try {
      await equipmentAPI.assignEquipItemOrItemsToEmp(employeeId, selectedEquipments);
      messageApi.success("Equipments assigned successfully");
      onAssignSuccess(); // Refresh the employee data
    } catch (error) {
      messageApi.error("Error assigning equipments");
      console.error("Error assigning equipments:", error);
    }
    setShowModal(false);
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={<h2 className="text-zinc-900 font-bold text-3xl select-none">Assign Equipment</h2>}
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
          <Button key="cancel" onClick={() => setShowModal(false)}>
            Cancel
          </Button>,
          <Button key="assign" type="primary" onClick={handleAssign}>
            Assign {selectedEquipments.length > 0 ? `(${selectedEquipments.length})` : ""}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" variant="filled" className="flex flex-col w-full">
          <Form.Item name="equipmentList" className="flex flex-col w-full">
            <div className="flex flex-col gap-2 w-full h-[400px] overflow-y-auto">
              {unassingedEquips.map((item) => (
                <EquipCheckItem
                  key={item.equipmentId}
                  equipmentId={item.equipmentId}
                  equipmentName={item.equipmentName}
                  equipmentCategoryId={item.equipmentCatId}
                  equipmentCategoryName={item.equipmentCategoryName}
                  condition={item.condition}
                  isSelected={selectedEquipments.includes(item.equipmentId)}
                  onClick={() => handleSelect(item.equipmentId)}
                />
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AssignEquipsToExistEmpModal;
