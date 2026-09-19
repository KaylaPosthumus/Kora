import React, { useState, useEffect } from "react";
import GaugeComponent from "react-gauge-component";
import { LeaveBalanceBlock } from "@/features/leave/components";
import { getAdminEmpDetails } from "@/features/employees/api/employeesApi";
import { UPCOMING_AND_COMPLETED, subscribeToGatherings } from "@/features/gatherings/api/gatheringsApi";
import { EmpUser } from "@/shared/types/empUser";
import { formatRandAmount } from "@/utils/formatUtils";
import dayjs from "dayjs";
import { Icons } from "@/constants/icons";
import { calculateNextPayDay } from "@/utils/dateUtils";
import { generatePayrollPDF } from "@/utils/pdfUtils";
import { Gender, PayCycle } from "@/shared/types/common";

import { useParams } from "react-router-dom";
import { Spin } from "antd";
import { EmpGatheringBox } from "@/features/gatherings/components";
import { getFullCurrentUser } from "@/services/authService";

const EmployeeHome: React.FC = () => {
  const [empUser, setEmpUser] = useState<EmpUser | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<any>(null); //
  const [empUserRatingMetrics, setEmpUserRatingMetrics] = useState<any>(null); // Replace with actual type if availableReplace with actual type if available
  const [nextPayDay, setNextPayDay] = useState<string | null>(null);
  const [gatherings, setGatherings] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  useEffect(() => {
    const fetchUserAndSetId = async () => {
      const user = await getFullCurrentUser();
      if (user?.employeeId) {
        setEmployeeId(user.employeeId);
      }
    };
    fetchUserAndSetId();
  }, []);

  const fetchEmployeeData = async () => {
    if (!employeeId) {
      console.log("No employeeId available, skipping fetchEmployeeData");
      return;
    }

    try {
      setLoading(true);
      const user = await getFullCurrentUser();
      if (!user?.employeeId) {
        console.log("No user or employeeId found");
        setEmpUser(null);
        return;
      }

      const response = await getAdminEmpDetails(user.employeeId);
      const data: any = response.data;

      setEmpUser(data.empUser);
      setLeaveBalances(data.leaveBalances || []);
      setEmpUserRatingMetrics(data.empUserRatingMetrics);
    } catch (error) {
      console.error("Error fetching employee data:", error);
      setEmpUser(null);
    } finally {
      setLoading(false); // ✅ Ensure spinner stops
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId]);

  // The meetings overview follows the same live subscription the meetings page
  // uses, so a meeting scheduled or completed while this page is open shows up
  // here too. Reversed to match the one-shot read this replaced, which returned
  // newest first.
  useEffect(() => {
    if (!employeeId) return;

    const unsubscribe = subscribeToGatherings(
      { field: "employeeId", id: employeeId, ...UPCOMING_AND_COMPLETED },
      (data) => setGatherings([...data].reverse()),
      (error) => {
        console.error("Error subscribing to gatherings:", error);
        setGatherings([]);
      }
    );

    return unsubscribe;
  }, [employeeId]);

  //For the Quote of the day
  const [quote, setQuote] = useState<string>("");
  const [quoteAuthor, setQuoteAuthor] = useState<string>("");

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const cachedQuote = localStorage.getItem("dailyQuote");
        const cachedDate = localStorage.getItem("dailyQuoteDate");
        const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'

        if (cachedQuote && cachedDate === today) {
          const { quote, author } = JSON.parse(cachedQuote);
          setQuote(quote);
          setQuoteAuthor(author);
          return;
        }

        const response = await fetch("https://api.api-ninjas.com/v1/quotes", {
          headers: {
            "X-Api-Key": "/cP8Aq3lAI2uPIG9ePOHQg==8nCa4YBBLaFwGjYQ",
          },
        });

        const data = await response.json();
        const randomQuote = data[0];

        if (randomQuote) {
          setQuote(randomQuote.quote);
          setQuoteAuthor(randomQuote.author);
          localStorage.setItem(
            "dailyQuote",
            JSON.stringify({
              quote: randomQuote.quote,
              author: randomQuote.author,
            })
          );
          localStorage.setItem("dailyQuoteDate", today);
        }
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        setQuote("Stay positive and keep moving forward.");
        setQuoteAuthor("Unknown");
      }
    };

    fetchQuote();
  }, []);

  useEffect(() => {
    if (empUser) {
      // Use lastPaidDate if available, otherwise use employDate
      const baseDate = empUser.lastPaidDate || empUser.employDate;
      setNextPayDay(calculateNextPayDay(empUser.payCycle, baseDate));
    }
  }, [empUser]);

  if (loading)
    return (
      <div className="w-full h-full flex flex-col justify-center items-center">
        <Spin size="large" />
      </div>
    );
  if (!empUser && !loading)
    return (
      <div className="w-full h-full flex flex-col gap-4 justify-center items-center">
        <h2 className="text-zinc-900 font-bold text-3xl text-center">Employee Not Found</h2>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto m-4">
      {empUser && (
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-zinc-900">Welcome, {empUser.fullName}</h1>
      )}
      <h4 className="text-zinc-900 mb-3">Stay informed and manage your tasks effortlessly.</h4>
      <div className="line-horisontal mb-4 bg-black" style={{ height: "1px" }}></div>

      <div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-8">
            <div className="grid grid-cols-12 gap-3">
              {/* Ratings */}
              <div className="col-span-12 md:col-span-5">
                <div className="text-zinc-500 font-semibold text-center mb-2">Your Ratings</div>
                <div className="bg-korastone-50 p-4 pt-2 rounded-2xl shadow-sm">
                  <div className="w-full py-4 flex flex-col gap-2 items-center" style={{ minHeight: 239 }}>
                    <GaugeComponent
                      minValue={0}
                      maxValue={500}
                      value={empUserRatingMetrics ? empUserRatingMetrics.averageRating * 100 : 0}
                      type="semicircle"
                      labels={{
                        valueLabel: {
                          formatTextValue: (value) => `${(Number(value) / 100).toFixed(2)}`,
                          style: { fontSize: "32px", fill: "#18181b" },
                        },
                        tickLabels: {
                          hideMinMax: false,
                          defaultTickValueConfig: {
                            formatTextValue: (value) => `${(Number(value) / 100).toFixed(1)}`,
                            style: { fontSize: "12px", fill: "#18181b" },
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
                    {empUserRatingMetrics ? (
                      <div className="text-center mt-2">
                        {empUserRatingMetrics.numberOfRatings > 0 ? (
                          <p className="text-zinc-500 text-sm">
                            Based on {empUserRatingMetrics.numberOfRatings} rating
                            {empUserRatingMetrics.numberOfRatings !== 1 ? "s" : ""}
                          </p>
                        ) : (
                          <p className="text-zinc-500 text-sm">No ratings yet</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center mt-2">
                        <p className="text-zinc-500 text-sm">You have not been rated yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Leave Balances */}
              <div className="col-span-12 md:col-span-7">
                <div className="text-zinc-500 font-semibold text-center mb-2">
                  Your Remaining Leave
                </div>
                <div className="flex flex-col items-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
                    {leaveBalances?.slice(0, 6).map((balance: any) => (
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
              </div>
            </div>
            {/* Payroll Information */}
            <div className="grid grid-cols-12 gap-3 pt-3">
              <div className="col-span-12">
                <div className="text-zinc-500 font-semibold text-center mb-2">
                  Your Payroll Information
                </div>
                <div className="bg-korastone-50 p-4 pt-2 rounded-2xl shadow-sm">
                  <div className="w-full flex flex-col gap-2 items-center">
                    <div className="bg-korastone-50 p-2 rounded-2xl w-full flex flex-col items-center">
                      <p className="text-zinc-500 text-sm mb-1">Salary</p>
                      <div className="flex flex-col items-center p-3 bg-korastone-200 w-full rounded-2xl">
                        <p className="text-zinc-900 text-xl">
                          {empUser ? formatRandAmount(empUser.salaryAmount) : "N/A"}
                        </p>
                        <p className="text-zinc-500 text-sm">
                          {empUser?.payCycle === PayCycle.Monthly
                            ? "monthly"
                            : empUser?.payCycle === PayCycle.BiWeekly
                            ? "bi-weekly"
                            : "weekly"}
                        </p>
                      </div>
                      <div className="flex flex-wrap w-full mt-2 gap-2 h-fit">
                        <div className="flex flex-col flex-1 basis-32 min-w-0 items-center">
                          <p className="text-zinc-500 text-sm mb-1">Last Paid</p>
                          <div className="flex justify-center items-center gap-2 p-3 bg-korastone-200 rounded-2xl h-full w-full">
                            <p className="text-zinc-900">
                              {empUser?.lastPaidDate
                                ? dayjs(empUser.lastPaidDate).format("DD/MM/YYYY")
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col flex-1 basis-32 min-w-0 items-center">
                          <p className="text-zinc-500 text-sm mb-1">Next Pay Day</p>
                          <div className="flex justify-center items-center gap-2 p-4 bg-korastone-200 w-full rounded-2xl h-full">
                            <p className="text-zinc-900">
                              {nextPayDay ? dayjs(nextPayDay).format("DD/MM/YYYY") : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col flex-1 basis-32 min-w-0 items-center">
                          <p className="text-transparent text-sm mb-1">..</p>
                          <div
                            className="flex justify-center items-center gap-2 p-4 hover:bg-korablue-200 border-2 border-korablue-500 rounded-2xl w-full cursor-pointer"
                            onClick={() => empUser && generatePayrollPDF(empUser)}
                            style={{ minHeight: 48 }}
                          >
                            <Icons.Upload className="text-korablue-600" />
                            <p className="text-korablue-600 font-medium text-sm">Export Payroll</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-3 pt-4 mb-4">
              <div className="col-span-12">
                <div className="bg-korablue-500 p-4 rounded-2xl justify-center text-white text-center shadow-sm">
                  <p>"{quote}"</p>
                  <p className="italic"> - {quoteAuthor}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">
            <div className="w-full">
              <div className="text-zinc-500 font-semibold text-center mb-2">Meetings with HR: Overview</div>
              <div className="relative">
                <div
                  className="grid gap-3 pr-2"
                  style={{
                    maxHeight: 700,
                    overflowY: "auto",
                    paddingBottom: 32, 
                  }}
                >
                  {gatherings.length > 0 ? (
                    gatherings.map((gathering) => (
                      <EmpGatheringBox key={gathering.$id} gathering={gathering} />
                    ))
                  ) : (
                    <div className="text-center text-zinc-400 py-8">
                      No meetings or reviews to show.
                    </div>
                  )}
                </div>
                {/* Fade overlay at the bottom */}
                <div
                  className="pointer-events-none w-full absolute left-0 right-0 bottom-0 h-7"
                  style={{
                    background: "linear-gradient(to bottom, rgba(244,244,242,0), #E7E5E4 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeHome;
