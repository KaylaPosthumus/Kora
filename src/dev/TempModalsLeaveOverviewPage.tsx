import React, { useState } from "react";
import KoraBtn from "../components/buttons/KoraBtn";
import ApplyForLeaveModal from "../components/modals/ApplyForLeaveModal";

function TempModalsLeaveOverviewPage() {
  const [showApplyForLeaveModal, setShowApplyForLeaveModal] = useState(false);

  return (
    <div className="max-w-7xl mx-auto m-4">
      <h1 className="text-3xl font-bold mb-6 text-zinc-900">Modal on Leave Overview</h1>
      <KoraBtn onClick={() => setShowApplyForLeaveModal(true)}>Apply for Leave Modal</KoraBtn>
      <ApplyForLeaveModal
        showModal={showApplyForLeaveModal}
        setShowModal={setShowApplyForLeaveModal}
        onSubmitSuccess={() => {
          ("Functionality not implemented yet");
        }}
      />
    </div>
  );
}

export default TempModalsLeaveOverviewPage;
