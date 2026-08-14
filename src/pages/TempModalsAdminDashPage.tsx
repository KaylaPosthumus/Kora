import React, { useState } from "react";

// Import Modals
import CreatePRModal from "../components/modals/CreatePRModal";
import EditPRModal from "../components/modals/EditPRModal";

// Import Components
import CoriBtn from "../components/buttons/CoriBtn";

function TempModalsAdminDashPage() {
  // State for the modals
  const [showCreatePRModal, setShowCreatePRModal] = useState(false);
  const [showEditPRModal, setShowEditPRModal] = useState(false);

  return (
    <div className="max-w-7xl mx-auto m-4">
      <h1 className="text-3xl font-bold mb-6 text-zinc-900">Modals on the Admin Dash</h1>
      <div className="flex gap-4">
        <CoriBtn onClick={() => setShowCreatePRModal(true)}>Open Create PR Modal</CoriBtn>
        <CoriBtn onClick={() => setShowEditPRModal(true)}>Open Edit PR Modal</CoriBtn>
      </div>
      <CreatePRModal
        showModal={showCreatePRModal}
        setShowModal={setShowCreatePRModal}
        adminId=""
        onCreateSuccess={() => {
          ("Functionality not implemented yet");
        }}
      />
      <EditPRModal
        showModal={showEditPRModal}
        setShowModal={setShowEditPRModal}
        onEditSuccess={() => {
          ("Functionality not implemented yet");
        }}
      />
    </div>
  );
}

export default TempModalsAdminDashPage;
