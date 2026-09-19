import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// Import 3rd party components / plugins
import type { GetProp, TableProps } from "antd";
import { Table, Avatar, Dropdown, Tooltip, Input, Spin } from "antd";
import type { SorterResult, FilterValue } from "antd/es/table/interface";
import dayjs from "dayjs";

// Import Services
import { employeeAPI, pageAPI } from "../../services/api.service";

// Import Components
import KoraBtn from "../../components/buttons/KoraBtn";
import EmployTypeBadge from "../../components/badges/EmployTypeBadge";

// Import Constants
import { Icons } from "../../constants/icons";

// Import Utils
import { formatRandAmount, formatShortRandAmount } from "../../utils/formatUtils";
import { getFullImageUrl } from "../../utils/imageUtils";
import { isDateInPast, formatTimestampToDate, calculateNextPayDay } from "../../utils/dateUtils";

// Import Types / Interfaces
import { EmployeeListItem } from "@/shared/types/employeeListItem";
import { EmployType, Gender, PayCycle } from "@/shared/types/common";

// Authentication
import { getFullCurrentUser } from "../../services/authService";

// Types for table
type ColumnsType<T extends object = object> = TableProps<T>["columns"];
type TablePaginationConfig = Exclude<GetProp<TableProps, "pagination">, boolean>;

// Record list interface
interface DataType {
  employeeId: string;
  fullName: string;
  gender: Gender;
  jobTitle: string;
  department: string;
  profilePicture: string | null;
  employType: EmployType;
  salaryAmount: number;
  payCycle: PayCycle;
  lastPaidDate: string | null;
  isSuspended: boolean;
  averageRating?: number;
  numberOfRatings?: number;
  totalRemainingDays?: number;
  totalLeaveDays?: number;
}

// Table parameters interface
interface TableParams {
  pagination?: TablePaginationConfig;
  sortField?: string;
  sortOrder?: "ascend" | "descend" | null;
  filters?: Parameters<GetProp<TableProps, "onChange">>[1];
}

const AdminEmployeeManagement: React.FC = () => {
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState(""); // Searchbar value
  const [allData, setAllData] = useState<DataType[]>([]); // Table data
  const [loading, setLoading] = useState(false);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1, // Start on page 1
      pageSize: 10, // Show 10 items per page
    },
  });

  const [adminId, setAdminId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndSetId = async () => {
      const user = await getFullCurrentUser();
      setLoading(true);
      if (user?.adminId) {
        setAdminId(user.adminId);
        setLoading(false);
      }
    };
    fetchUserAndSetId();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get ALL the employee data from the server
      const response = await pageAPI.getAdminEmpManagement();

      // Clean up the data to match DataType
      const processedData = response.data.map((item: EmployeeListItem) => ({
        employeeId: item.empUser.employeeId,
        fullName: item.empUser.fullName,
        gender: item.empUser.gender,
        jobTitle: item.empUser.jobTitle,
        department: item.empUser.department,
        profilePicture: item.empUser.profilePicture,
        employType: item.empUser.employType,
        salaryAmount: item.empUser.salaryAmount,
        payCycle: item.empUser.payCycle,
        lastPaidDate: item.empUser.lastPaidDate,
        isSuspended: item.empUser.isSuspended,
        averageRating: item.empUserRatingMetrics?.averageRating,
        numberOfRatings: item.empUserRatingMetrics?.numberOfRatings,
        totalRemainingDays: item.totalLeaveBalanceSum?.totalRemainingDays,
        totalLeaveDays: item.totalLeaveBalanceSum?.totalLeaveDays,
      })) as DataType[];

      setAllData(processedData);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // When page loads
  useEffect(() => {
    fetchData();
  }, []);

  const handleTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<DataType> | SorterResult<DataType>[]
    ) => {
      // Update our table parameters with the new settings
      setTableParams({
        pagination,
        filters,
        // Handle both single and multiple column sorting
        sortOrder: Array.isArray(sorter) ? sorter[0]?.order : sorter.order,
        sortField: Array.isArray(sorter) ? (sorter[0]?.field as string) : (sorter.field as string),
      });
    },
    []
  );

  // Search Function
  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  // useMemo to only recalculate the displayed data when:
  // - allData changes (new data from server)
  // - tableParams changes (user changed page/sort/filter)
  const processedData = useMemo(() => {
    let data = [...allData];

    // Apply search filter if there's a search value
    if (searchValue) {
      data = data.filter((item) => item.fullName.toLowerCase().includes(searchValue.toLowerCase()));
    }

    // If the user wants to sort the data
    if (tableParams.sortField && tableParams.sortOrder) {
      data.sort((a, b) => {
        // Get the values we want to compare
        const aValue = a[tableParams.sortField as keyof DataType] ?? "";
        const bValue = b[tableParams.sortField as keyof DataType] ?? "";

        // Sort in ascending or descending order
        if (tableParams.sortOrder === "ascend") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    }

    // Apply pagination
    const { current = 1, pageSize = 10 } = tableParams.pagination || {};
    const start = (current - 1) * pageSize;
    const end = start + pageSize;

    return data.slice(start, end);
  }, [allData, tableParams, searchValue]);

  const handleToggleSuspension = useCallback(
    async (employeeId: string) => {
      try {
        await employeeAPI.toggleEmpSuspension(employeeId);
        fetchData();
      } catch (error) {
        console.error("Error toggling employee suspension:", error);
      }
    },
    [fetchData]
  );

  // Memoize the columns configuration
  const columns = useMemo<ColumnsType<DataType>>(
    () => [
      {
        title: "Name",
        dataIndex: "fullName",
        sorter: true,
        width: "24%",
        render: (value, record) => (
          <div className="flex items-center gap-2">
            {record.profilePicture ? (
              <Avatar
                src={getFullImageUrl(record.profilePicture)}
                className="bg-warmstone-600 h-12 w-12 rounded-full object-cover border-2 border-zinc-700"
              />
            ) : (
              <Avatar
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${record.fullName}`}
                className="bg-warmstone-600 h-12 w-12 rounded-full object-cover border-2 border-zinc-700"
              />
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <p className="font-medium min-w-fit">{record.fullName}</p>
                {record.gender === Gender.Female ? (
                  <Icons.Female className="text-pink-500" />
                ) : record.gender === Gender.Male ? (
                  <Icons.Male className="text-blue-500" />
                ) : (
                  <Icons.Transgender className="text-purple-500" />
                )}
              </div>
              <p className="text-sm text-zinc-500">{record.jobTitle}</p>
            </div>
          </div>
        ),
      },
      {
        title: "Ratings",
        dataIndex: "averageRating",
        sorter: true,
        render: (_, record) => (
          <>
            {record.averageRating ? (
              <div className="flex items-center">
                <Icons.StarRounded className="text-yellow-500" />
                <p>{record.averageRating}</p>
                <p className="text-zinc-500 text-[12px] ml-2">({record.numberOfRatings})</p>
              </div>
            ) : (
              <p className="text-zinc-500 text-[12px]">No Ratings</p>
            )}
          </>
        ),
      },
      {
        title: "Employment",
        dataIndex: "employType",
        sorter: true,
        render: (_, record) => {
          const handleEmploymentClick = (e: React.MouseEvent) => {
            e.stopPropagation();
          };

          return (
            <div onClick={handleEmploymentClick}>
              {record.isSuspended ? (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "unsuspend",
                        label: "Unsuspend Employee",
                        icon: <Icons.ThumbUpAlt />,
                        onClick: () => {
                          handleToggleSuspension(record.employeeId);
                        },
                      },
                    ],
                  }}
                  trigger={["click"]}
                >
                  <div>
                    <EmployTypeBadge status="suspended" />
                  </div>
                </Dropdown>
              ) : (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "suspend",
                        label: "Suspend Employee",
                        icon: <Icons.ThumbDownAlt />,
                        onClick: () => {
                          handleToggleSuspension(record.employeeId);
                        },
                      },
                    ],
                  }}
                  trigger={["click"]}
                >
                  <div>
                    <EmployTypeBadge status={record.employType} />
                  </div>
                </Dropdown>
              )}
            </div>
          );
        },
      },
      {
        title: "Salary",
        dataIndex: "salaryAmount",
        sorter: true,
        render: (_, record) => (
          <div className="flex flex-col">
            <p>{formatShortRandAmount(record.salaryAmount)}</p>
            <p className="text-[12px] text-zinc-500">
              {record.payCycle === PayCycle.Monthly
                ? "monthly"
                : record.payCycle === PayCycle.Weekly
                ? "weekly"
                : "bi-weekly"}
            </p>
          </div>
        ),
      },
      {
        title: "Last Paid",
        dataIndex: "lastPaidDate",
        sorter: true,
        width: "15%",
        render: (date, record) => {
          const isLate = isDateInPast(calculateNextPayDay(record.payCycle, date));
          const nextPayDate = calculateNextPayDay(record.payCycle, date);

          if (!date) {
            return (
              <Tooltip title="Employee has never been paid." placement="topLeft">
                <div className="flex flex-col">
                  <p className="text-zinc-500 text-[12px]">---</p>
                </div>
              </Tooltip>
            );
          }

          if (isLate) {
            return (
              <Tooltip
                title={
                  <>
                    Payment was due on
                    <br />
                    {nextPayDate}.
                  </>
                }
                placement="top"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                color="red"
              >
                <div className="flex flex-col">
                  <p>{formatTimestampToDate(date)}</p>
                  <div className="flex items-center gap-1">
                    <Icons.WatchLater className="text-red-500" fontSize="small" />
                    <p className="text-red-500 text-[12px]">
                      {dayjs(nextPayDate).fromNow(true)} late
                    </p>
                  </div>
                </div>
              </Tooltip>
            );
          }

          return (
            <Tooltip
              title={
                <>
                  Next Payment in {dayjs(nextPayDate).fromNow(true)}
                  <br />
                  on {nextPayDate}.
                </>
              }
              placement="topLeft"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <p>{formatTimestampToDate(date)}</p>
                  <Icons.CheckCircle className="text-corigreen-500" fontSize="small" />
                </div>
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: "Leave",
        dataIndex: "totalRemainingDays",
        sorter: true,
        render: (_, record) => (
          <div className="flex flex-col items-center">
            <p>{record.totalRemainingDays}</p>
            <p className="text-zinc-500 text-[12px]">{record.totalLeaveDays} days</p>
          </div>
        ),
      },
    ],
    [handleToggleSuspension]
  );

  return (
    <div className="max-w-7xl mx-auto m-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Icons.DirectionsWalk fontSize="large" className="text-zinc-900" />
          <h1 className="text-3xl font-bold text-zinc-900">Employees</h1>
        </div>
        <div className="flex items-center gap-4">
          <Input.Search
            placeholder="Search By Name"
            allowClear
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <KoraBtn style="black" onClick={() => navigate("/admin/create-employee")}>
            New
            <Icons.Add />
          </KoraBtn>
        </div>
      </div>
      {allData.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : (
        <Table<DataType>
          columns={columns}
          rowKey={(record) => record.employeeId}
          dataSource={processedData}
          pagination={{
            ...tableParams.pagination,
            total: allData.length,
          }}
          loading={loading}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => navigate(`/admin/individual-employee/${record.employeeId}`),
            className: "cursor-pointer hover:bg-zinc-50",
          })}
        />
      )}
    </div>
  );
};

export default AdminEmployeeManagement;
