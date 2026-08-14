// Wolf Botha
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Import 3rd party components / plugins
import GaugeComponent from "react-gauge-component";
import { Avatar, DatePicker, Dropdown, Tooltip, message, Button, Spin } from "antd";
import dayjs from "dayjs"; // For simple date formatting
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// Import React Components
import CoriBtn from "../../components/buttons/CoriBtn";
import CoriCircleBtn from "../../components/buttons/CoriCircleBtn";
import EquipmentListItem from "../../components/equipment/EquipmentListItem";
import LeaveBalanceBlock from "../../components/leave/LeaveBalanceBlock";
import EmployTypeBadge from "../../components/badges/EmployTypeBadge";
import TimeTodayBadge from "../../components/badges/TimeTodayBadge";
import ProfilePicUploadBtn from "../../components/uploading/ProfilePicUploadBtn";

// Modals
import AdminEditEmpDetailsModal from "../../components/modals/AdminEditEmpDetailsModal";
import AdminEditEmpPayrollModal from "../../components/modals/AdminEditEmpPayrollModal";
import CreateAssignedEquipModal from "../../components/modals/CreateAssignedEquipModal";
import AssignEquipsToExistEmpModal from "../../components/modals/AssignEquipsToExistEmpModal";
import EditEquipDetailsModal from "../../components/modals/EditEquipDetailsModal";
import UnlinkEquipmentModal from "../../components/modals/UnlinkEquipmentModal";
import DeleteEquipmentModal from "../../components/modals/DeleteEquipmentModal";
import TerminateEmployeeModal from "../../components/modals/TerminateEmployeeModal";

// Import Icons
import { Icons } from "../../constants/icons";

// Import Assets
import GoogleIcon from "../../assets/icons/googleIcon.png";

// Import Utils / Functions
import {
  calculateNextPayDay,
  formatEmploymentDuration,
  calculatePreviousPayDay,
} from "../../utils/dateUtils";
import { formatPhone, formatRandAmount } from "../../utils/formatUtils";
import { getFullImageUrl } from "../../utils/imageUtils";
import { pageAPI, employeeAPI, empUserAPI } from "../../services/api.service";

// Types / Interfaces
import { Gender, PayCycle } from "../../types/common";
import { EmpUser } from "../../interfaces/people/empUser";
import { LeaveBalance } from "../../interfaces/leave/leaveBalance";
import { EmpUserRatingMetrics } from "../../interfaces/people/empUserRatingMetrics";
import { Equipment } from "../../interfaces/equipment/equipment";
import { Gathering } from "../../interfaces/gathering/gathering";
import AdminGatheringBox from "../../components/gathering/AdminGatheringBox";

// Authentication
import { getFullCurrentUser } from "../../services/authService";

// Admin Employee Details Page Response Interface
interface AdminEmpDetailsResponse {
  empUser: EmpUser;
  equipment: Equipment[];
  leaveBalances: LeaveBalance[];
  empUserRatingMetrics: EmpUserRatingMetrics;
  gatherings: Gathering[];
}

const AdminIndividualEmployee: React.FC = () => {
  // Get the employee ID from the URL params
  const { employeeId } = useParams();

  // Navigation
  const navigate = useNavigate();

  // States
  const [empUser, setEmpUser] = useState<EmpUser | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [empUserRatingMetrics, setEmpUserRatingMetrics] = useState<EmpUserRatingMetrics | null>(
    null
  );
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPayDay, setNextPayDay] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Modal States
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showEditPayrollModal, setShowEditPayrollModal] = useState(false);
  const [showCreateAssignedEquipModal, setShowCreateAssignedEquipModal] = useState(false);
  const [showAssignExistingEquipModal, setShowAssignExistingEquipModal] = useState(false);
  const [showManageEquipmentModal, setShowManageEquipmentModal] = useState(false);
  const [showTerminateEmployeeModal, setShowTerminateEmployeeModal] = useState(false);
  const [showUnlinkEquipmentModal, setShowUnlinkEquipmentModal] = useState(false);
  const [showDeleteEquipmentModal, setShowDeleteEquipmentModal] = useState(false);

  // Message System
  const [messageApi, ContextHolder] = message.useMessage();

  const [adminId, setAdminId] = useState<string | null>(null);
  useEffect(() => {
    const fetchUserAndSetId = async () => {
      const user = await getFullCurrentUser();
      if (user?.adminId) {
        setAdminId(user.adminId);
      }
    };
    fetchUserAndSetId();
  }, []);

  const fetchEmployee = async () => {
    try {
      if (employeeId) {
        // Fetch the specific employee by ID using the new API endpoint
        const response = await pageAPI.getAdminEmpDetails(employeeId);
        const data: AdminEmpDetailsResponse = response.data;

        setEmpUser(data.empUser);
        setEquipment(data.equipment);
        // TODO Set leave balances in a specific order
        setLeaveBalances(data.leaveBalances);
        setEmpUserRatingMetrics(data.empUserRatingMetrics);
        setGatherings(data.gatherings);
      } else {
        // If no ID provided, redirect to employee management page
        navigate("/admin/employees");
      }
    } catch (error) {
      console.error("Error fetching employee:", error);
      // Handle error case
      return <div>Something went wrong</div>;
    } finally {
      setLoading(false);
    }
  };

  // On page load (fetch employee data)
  useEffect(() => {
    fetchEmployee();
  }, [employeeId, navigate]);

  // Calculate the next pay day & store it in state
  useEffect(() => {
    if (empUser) {
      // If the employee has a last paid date, use that to calculate the next pay day
      if (empUser.lastPaidDate) {
        setNextPayDay(calculateNextPayDay(empUser.payCycle, empUser.lastPaidDate));
      } else {
        // Else, use their employment date to calculate the next pay day
        setNextPayDay(calculateNextPayDay(empUser.payCycle, empUser.employDate));
      }
    }
  }, [empUser]);

  // Toggle suspension status of an employee
  const toggleEmpSuspension = async () => {
    try {
      if (employeeId) {
        console.log("Toggling suspension status of employee:", employeeId);
        await employeeAPI.toggleEmpSuspension(employeeId);
        fetchEmployee(); // Refresh the employee data
        messageApi.success("Employee suspension status updated");
      }
    } catch (error) {
      console.error("Error toggling employee suspension:", error);
      messageApi.error("Error updating employee suspension status");
    }
  };

  // Update last paid date
  const updateLastPaidDate = async (newDate: string) => {
    try {
      // There must be an employee ID
      if (employeeId) {
        await empUserAPI.updateEmpUserById(employeeId, {
          lastPaidDate: newDate,
        });
        fetchEmployee(); // Refresh the employee data
        messageApi.success("Last paid date updated");
      } else {
        // If no ID provided, redirect to employee management page
        messageApi.error("Something went wrong - Employee ID not found");
      }
    } catch (error) {
      messageApi.error("Error updating last paid date");
    }
  };

  // Undo payment (shift last paid by -1 pay cycle)
  const onUndoPayment = async () => {
    // Check if empUser is defined
    if (empUser) {
      let calcPrevPayday: string;
      if (empUser.lastPaidDate) {
        // Calculate the previous pay day using the last paid date
        calcPrevPayday = calculatePreviousPayDay(empUser?.payCycle, empUser?.lastPaidDate);
      } else {
        // Calculate the previous pay day using the employment date
        calcPrevPayday = calculatePreviousPayDay(empUser?.payCycle, empUser?.employDate);
      }

      // Format the previous pay day
      const previousPayDay = dayjs(calcPrevPayday).format("YYYY-MM-DD");

      // Check if the previous pay day is before the employee's employment date
      if (dayjs(previousPayDay).isBefore(dayjs(empUser.employDate))) {
        messageApi.error({
          content: `You can't set the last paid date to before ${empUser.fullName} was employed.`,
          duration: 8,
        });
        return;
      }

      // Update the last paid date
      try {
        // There must be an employee ID
        if (employeeId) {
          await empUserAPI.updateEmpUserById(employeeId, {
            lastPaidDate: previousPayDay,
          });
          fetchEmployee(); // Refresh the employee data
          messageApi.success("Payment undone");
        } else {
          messageApi.error("Something went wrong - Employee ID not found");
        }
      } catch (error) {
        messageApi.error("Error undoing payment");
      }
    }
  };

  // Pay employee (set last paid as today)
  const onPayNow = async () => {
    // Update the last paid date
    try {
      // There must be an employee ID
      if (employeeId) {
        // Set the last paid date to the next payday
        await empUserAPI.updateEmpUserById(employeeId, {
          lastPaidDate: dayjs().format("YYYY-MM-DD"),
        });
        fetchEmployee(); // Refresh the employee data
        messageApi.success("Payment updated");
      } else {
        messageApi.error("Something went wrong - Employee ID not found");
      }
    } catch (error) {
      messageApi.error("Error updating payment");
    }
  };

  const handleProfilePicUploadSuccess = async (url: string) => {
    // console.log("Profile picture URL:", url);
    if (employeeId) {
      const response = await empUserAPI.updateEmpUserById(employeeId, {
        profilePicture: url,
      });

      // wait before refreshing data
      await response.data;
      fetchEmployee();
    }
  };

  if (loading)
    return (
      <div className="w-full h-full flex flex-col justify-center items-center">
        <Spin size="large" />
      </div>
    );
  if (!empUser)
    return (
      <div className="w-full h-full flex flex-col gap-4 justify-center items-center">
        <h2 className="text-zinc-900 font-bold text-3xl text-center">
          Employee Details Couldn't Be Loaded
        </h2>
      </div>
    );

  return (
    <div className="">
      {ContextHolder} {/* Message System */}
      <div className="max-w-7xl mx-auto m-4 pb-4">
        {/* Top Heading with buttons */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 items-center">
            <CoriBtn style="black" iconOnly onClick={() => navigate("/admin/employees")}>
              <Icons.ArrowBack />
            </CoriBtn>
            <h1 className="text-3xl font-bold text-zinc-900">Employee Details</h1>
          </div>
          <div className="flex gap-2">
            <CoriBtn secondary style="black" onClick={() => setShowEditDetailsModal(true)}>
              <Icons.Edit />
              Edit Details
            </CoriBtn>
            <CoriBtn style="black" onClick={toggleEmpSuspension}>
              {empUser?.isSuspended ? "Unsuspend" : "Suspend"}
            </CoriBtn>
            <CoriBtn style="red" onClick={() => setShowTerminateEmployeeModal(true)}>
              Terminate
            </CoriBtn>
          </div>
        </div>
        {/* Page Body */}
        <div className="flex gap-4">
          <div className="max-w-1/2 min-w-1/2 w-1/2 flex flex-col gap-4">
            {/* Employee Details */}
            <div className="bg-warmstone-50 p-4 rounded-2xl flex flex-col shadow-sm">
              <div className="flex gap-4">
                <div className="relative">
                  {empUser.profilePicture ? (
                    <Avatar
                      src={getFullImageUrl(empUser.profilePicture)}
                      size={104}
                      className="bg-warmstone-600 h-24 w-24 rounded-full object-cover border-2 border-zinc-700"
                    />
                  ) : (
                    <Avatar
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${empUser.fullName}`}
                      size={104}
                      className="bg-warmstone-600 h-24 w-24 rounded-full object-cover border-2 border-zinc-700"
                    />
                  )}
                  {/* If not google user */}
                  {empUser.googleId === null && (
                    <ProfilePicUploadBtn
                      onUploadSuccess={handleProfilePicUploadSuccess}
                      className="absolute bottom-0 right-0"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-zinc-500">Employee ID 00-{empUser.employeeId}</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-zinc-900 font-bold text-3xl">{empUser.fullName}</h2>
                    {empUser.googleId && (
                      <Tooltip title="Signed up with Google">
                        <img src={GoogleIcon} alt="Google" className="w-5 h-5" />
                      </Tooltip>
                    )}
                  </div>
                  <Tooltip
                    title={`${
                      empUser.jobTitle
                    } in the ${empUser.department.toLowerCase()} department`}
                    placement="bottomLeft"
                  >
                    <div className="flex gap-2 items-center justify-between overflow-clip">
                      {/* <WorkIcon /> */}
                      <p className="text-zinc-900">{empUser.jobTitle}</p>
                      <p className="text-zinc-900">•</p>
                      <p className="text-zinc-500">{empUser.department}</p>
                      <div className="w-fit">
                        {empUser.isSuspended ? (
                          <EmployTypeBadge status="suspended" />
                        ) : (
                          <EmployTypeBadge status={empUser.employType} />
                        )}
                      </div>
                    </div>
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-8">
                <div className="flex">
                  <div className="flex flex-grow flex-col gap-4 w-1/2">
                    <div className="flex gap-2 items-center">
                      {empUser.gender === Gender.Female ? (
                        <Icons.Female className="text-pink-500" />
                      ) : empUser.gender === Gender.Male ? (
                        <Icons.Male className="text-blue-500" />
                      ) : (
                        <Icons.Transgender className="text-purple-500" />
                      )}
                      <p className="text-zinc-500">
                        {empUser.gender === Gender.Female
                          ? "Female"
                          : empUser.gender === Gender.Male
                          ? "Male"
                          : "Other"}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Icons.Cake />
                      <p className="text-zinc-500">
                        {empUser.dateOfBirth}
                        <span className="text-zinc-400 text-sm ml-2">
                          ({dayjs(empUser.dateOfBirth).fromNow(true)} old)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-grow flex-col gap-4 w-1/2">
                    <div className="flex gap-2 items-center">
                      <Icons.Phone />
                      <p className="text-zinc-500">{formatPhone(empUser.phoneNumber)}</p>
                    </div>
                    <Tooltip
                      title={empUser.email}
                      placement="top"
                      overlayInnerStyle={{
                        width: "fit-content",
                      }}
                    >
                      <div className="flex gap-2 items-center">
                        <Icons.Email />
                        <p className="text-zinc-500 text-truncate">{empUser.email}</p>
                      </div>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Icons.AssistantPhoto />
                  <p className="text-zinc-500">
                    Employed for {formatEmploymentDuration(empUser.employDate)}
                    <span className="text-zinc-400 text-sm ml-2">
                      ({dayjs(empUser.employDate).format("DD MMM YYYY")})
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Payroll Information */}
            <div className="w-full flex flex-col gap-2 items-center">
              <h2 className="text-zinc-500 font-semibold">Payroll</h2>
              <div className="bg-warmstone-50 p-4 rounded-2xl w-full flex flex-col items-center shadow-sm group">
                <p className="text-zinc-500 text-sm mb-1">Salary</p>
                <div className="flex justify-center items-center gap-4 p-4 bg-warmstone-200 w-full rounded-2xl">
                  <div className="h-8 w-8 opacity-0">Spacer</div>
                  <div className="flex flex-col items-center ">
                    <p className="text-zinc-900 text-xl">
                      {formatRandAmount(empUser.salaryAmount)}
                    </p>
                    <p className="text-zinc-500 text-sm">
                      {empUser.payCycle === PayCycle.Monthly
                        ? "monthly"
                        : empUser.payCycle === PayCycle.BiWeekly
                        ? "bi-weekly"
                        : "weekly"}
                    </p>
                  </div>
                  <CoriCircleBtn
                    secondary
                    icon={<Icons.Edit />}
                    onClick={() => setShowEditPayrollModal(true)}
                  />
                </div>
                <div className="flex w-full mt-2 gap-2 h-fit">
                  <div className="flex flex-col w-1/2 items-center">
                    <p className="text-zinc-500 text-sm mb-1">Last Paid</p>
                    <div className="flex justify-center items-center gap-2 p-4 bg-warmstone-200 w-full rounded-2xl h-full">
                      {empUser.lastPaidDate ? (
                        <DatePicker
                          value={dayjs(empUser.lastPaidDate)}
                          format="DD MMM YYYY"
                          suffixIcon={<CoriCircleBtn secondary icon={<Icons.Edit />} />}
                          allowClear={false}
                          variant="borderless"
                          className="hover:cursor-pointer"
                          onChange={(date) => updateLastPaidDate(date?.format("YYYY-MM-DD") || "")}
                          // Only allow dates after the employee's employment date and before today
                          minDate={dayjs(empUser.employDate)}
                          maxDate={dayjs()}
                        />
                      ) : (
                        <DatePicker
                          placeholder="Set First Payment"
                          format="DD MMM YYYY"
                          suffixIcon={<CoriCircleBtn secondary icon={<Icons.Add />} />}
                          allowClear={false}
                          variant="borderless"
                          className="hover:cursor-pointer w-full"
                          onChange={(date) => updateLastPaidDate(date?.format("YYYY-MM-DD") || "")}
                          // Only allow dates after the employee's employment date and before today
                          minDate={dayjs(empUser.employDate)}
                          maxDate={dayjs()}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col w-1/2 items-center">
                    <p className="text-zinc-500 text-sm mb-1">Next Pay Day</p>
                    <div className="flex justify-center items-center gap-2 p-4 bg-warmstone-200 w-full rounded-2xl h-full">
                      {empUser.lastPaidDate ? (
                        <>
                          {nextPayDay && (
                            <>
                              <p className="text-zinc-900">{nextPayDay}</p>
                              <TimeTodayBadge date={nextPayDay} />
                            </>
                          )}
                        </>
                      ) : (
                        <p className="text-zinc-300 text-2xl font-light">N/A</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex w-full gap-2 group-hover:mt-4 h-0 group-hover:h-10 transition-all duration-300 overflow-hidden">
                  <Tooltip
                    title={`Undo Payment by ${
                      empUser.payCycle === PayCycle.Monthly
                        ? "a Month"
                        : empUser.payCycle === PayCycle.BiWeekly
                        ? "2 Weeks"
                        : "a Week"
                    }`}
                  >
                    <div>
                      <CoriBtn
                        secondary
                        style="black"
                        onClick={onUndoPayment}
                        disabled={!empUser.lastPaidDate}
                        iconOnly
                      >
                        <Icons.Undo />
                      </CoriBtn>
                    </div>
                  </Tooltip>
                  <CoriBtn style="black" onClick={onPayNow}>
                    Pay Today
                  </CoriBtn>
                </div>
              </div>
            </div>

            {/* Equipment */}
            <div className="w-full flex flex-col gap-2 items-center relative">
              <div className="flex gap-2 items-center">
                <h2 className="text-zinc-500 font-semibold">Equipment</h2>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "create",
                        label: "Create Brand New",
                        icon: <Icons.AutoAwesome />,
                        onClick: () => setShowCreateAssignedEquipModal(true),
                      },
                      {
                        key: "assign",
                        label: "Assign Existing",
                        icon: <Icons.PersonPin />,
                        onClick: () => setShowAssignExistingEquipModal(true),
                      },
                    ],
                  }}
                  trigger={["click"]}
                  placement="bottomLeft"
                >
                  <Button
                    type="text"
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-zinc-500 text-zinc-50 border-2 border-zinc-500 hover:bg-zinc-900 hover:text-zinc-50 hover:border-zinc-900"
                  >
                    <Icons.Add fontSize="small" />
                  </Button>
                </Dropdown>
              </div>
              <div
                className={`bg-warmstone-50 px-4 pt-4 rounded-2xl w-full flex flex-col items-center gap-4 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden
                ${equipment.length > 3 ? "h-[224px] pb-20" : "h-fit pb-4"}`}
              >
                {equipment.map((item) => (
                  <EquipmentListItem
                    key={item.equipmentId}
                    item={item}
                    onEdit={() => {
                      setSelectedEquipment(item);
                      setShowManageEquipmentModal(true);
                    }}
                    onUnlink={() => {
                      setSelectedEquipment(item);
                      setShowUnlinkEquipmentModal(true);
                    }}
                    onDelete={() => {
                      setSelectedEquipment(item);
                      setShowDeleteEquipmentModal(true);
                    }}
                    adminView
                  />
                ))}
                {/* Empty Message */}
                {equipment.length === 0 && (
                  <p className="text-zinc-500 py-4">No Equipment Assigned</p>
                )}
              </div>

              {equipment.length > 3 && (
                <div className="py-8 w-full bg-gradient-to-b from-transparent to-warmstone-50 absolute rounded-b-2xl bottom-0 left-0 right-0 text-transparent">
                  _
                </div>
              )}
            </div>
          </div>
          <div className="max-w-1/2 min-w-1/2 w-1/2">
            <div className="flex gap-4">
              {/* Leave Balances */}
              <div className="w-3/12 flex flex-col items-center gap-2">
                <h2 className="text-zinc-500 font-semibold">Leave</h2>
                <div className="flex flex-col gap-3 w-full">
                  {leaveBalances.map((balance) => (
                    <LeaveBalanceBlock
                      key={balance.leaveBalanceId}
                      leaveType={balance.leaveTypeName}
                      remainingDays={balance.remainingDays}
                      totalDays={balance.defaultDays}
                      description={balance.description}
                    />
                  ))}
                </div>
              </div>
              {/* Rating & Performance Reviews */}
              <div className="w-9/12 flex flex-col gap-4 max-w-9/12">
                <div className="w-full flex flex-col gap-2 items-center ">
                  <h2 className="text-zinc-500 font-semibold">Average Rating</h2>
                  <div className="w-full p-4 bg-warmstone-50 rounded-2xl shadow-sm">
                    <GaugeComponent
                      minValue={0}
                      maxValue={500}
                      value={empUserRatingMetrics ? empUserRatingMetrics.averageRating * 100 : 0}
                      type="semicircle"
                      labels={{
                        valueLabel: {
                          formatTextValue: (value) => `${value / 100}`,
                          style: { fontSize: "32px", fill: "#18181b" },
                        },
                        tickLabels: {
                          hideMinMax: false,
                          defaultTickValueConfig: {
                            formatTextValue: (value) => `${value / 100}`,
                            style: { fontSize: "16px", fill: "#18181b" },
                          },
                        },
                      }}
                      arc={{
                        nbSubArcs: 5,
                        colorArray: ["#d32f2f", "#f57c00", "#fbc02d", "#388e3c", "#1976d2"],
                        padding: 0.02,
                        width: 0.2,
                      }}
                      pointer={{
                        type: "arrow",
                        animationDuration: 1000,
                      }}
                    />
                    {empUserRatingMetrics && (
                      <div className="text-center mt-2">
                        <p className="text-zinc-500 text-sm">
                          Based on {empUserRatingMetrics.numberOfRatings} rating
                          {empUserRatingMetrics.numberOfRatings !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full flex flex-col items-center gap-2">
                  <h2 className="text-zinc-500 font-semibold">Meetings</h2>
                  {/* TODO Possibly create a performance review here? */}
                  <div className="w-full h-[580px] overflow-y-auto gap-4 flex flex-col rounded-2xl relative scrollbar-hide [&::-webkit-scrollbar]:hidden">
                    {gatherings.map((gathering) => (
                      <AdminGatheringBox
                        key={gathering.id}
                        gathering={gathering}
                        withAdminNamesTitle={true}
                        loggedInAdminId={adminId || ""}
                        onEditSuccess={fetchEmployee}
                        onDeleteSuccess={fetchEmployee}
                      />
                    ))}
                    {gatherings.length === 0 && (
                      <div className="bg-warmstone-50 p-4 rounded-2xl w-full flex flex-col items-center gap-3">
                        <p className="text-zinc-500 text-center">No Meetings Yet</p>
                      </div>
                    )}
                    {/* Empty Spacer Overlay (for fade out effect) */}
                    <div className="py-10 w-full bg-gradient-to-b from-transparent to-stone-200 sticky bottom-0 left-0 right-0 text-transparent">
                      _
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        {/* EQUIPMENT MODALS */}
        {/* Create & Assign Equipment Modal */}
        <CreateAssignedEquipModal
          showModal={showCreateAssignedEquipModal}
          setShowModal={setShowCreateAssignedEquipModal}
          employee={empUser}
          onCreate={fetchEmployee}
        />

        {/* Assign Multiple Existing Equipments Modal */}
        <AssignEquipsToExistEmpModal
          showModal={showAssignExistingEquipModal}
          setShowModal={setShowAssignExistingEquipModal}
          employeeId={empUser?.employeeId}
          onAssignSuccess={fetchEmployee}
        />

        {/* Edit Equipment Modal */}
        <EditEquipDetailsModal
          showModal={showManageEquipmentModal}
          setShowModal={setShowManageEquipmentModal}
          equipment={selectedEquipment}
          employeeId={empUser?.employeeId}
          employDate={empUser?.employDate}
          onEditSuccess={fetchEmployee}
        />

        {/* Unlink Equipment Modal */}
        <UnlinkEquipmentModal
          showModal={showUnlinkEquipmentModal}
          setShowModal={setShowUnlinkEquipmentModal}
          equipment={selectedEquipment}
          onUnlinkSuccess={fetchEmployee}
        />

        {/* Delete Equipment Modal */}
        <DeleteEquipmentModal
          showModal={showDeleteEquipmentModal}
          setShowModal={setShowDeleteEquipmentModal}
          equipment={selectedEquipment}
          onDeleteSuccess={fetchEmployee}
        />

        {/* EMPLOYEE MODALS*/}
        {/* Edit EmployeeDetails Modal */}
        <AdminEditEmpDetailsModal
          showModal={showEditDetailsModal}
          setShowModal={setShowEditDetailsModal}
          employee={empUser}
          onUpdate={fetchEmployee}
        />

        {/* Edit Employee Payroll Modal */}
        <AdminEditEmpPayrollModal
          showModal={showEditPayrollModal}
          setShowModal={setShowEditPayrollModal}
          employee={empUser}
          onUpdate={fetchEmployee}
        />

        {/* Terminate Employee Modal */}
        <TerminateEmployeeModal
          showModal={showTerminateEmployeeModal}
          setShowModal={setShowTerminateEmployeeModal}
          employeeFullName={empUser?.fullName || "this employee"}
          employeeId={employeeId || ""}
        />
      </div>
    </div>
  );
};

export default AdminIndividualEmployee;
