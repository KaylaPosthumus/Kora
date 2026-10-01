import React from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Icons } from "@/constants/icons";

  interface BarChartCardProps {
    empUserRatingMetrics: Array<{
      fullName: string;
      averageRating: number;
      mostRecentRating: number;
    }>;
  }

  // Conditional rendering for the BarChartCard component
  const BarChartCard: React.FC<BarChartCardProps> = ({ empUserRatingMetrics }) => {
    if (!empUserRatingMetrics || empUserRatingMetrics.length === 0) {
      // Same footprint as the chart plus its legend, so an empty card holds the row's height.
      return (
        <div className="h-[300px] flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-korablue-50 flex items-center justify-center">
            <Icons.StarRounded className="text-korablue-400" />
          </div>
          <p className="text-zinc-700 font-semibold">No ratings yet</p>
          <p className="text-zinc-500 text-sm max-w-[260px]">
            Ratings appear here once performance reviews have been completed.
          </p>
        </div>
      );
    }

  // Transform the empUserRatingMetrics data into chartData
  const labels = empUserRatingMetrics.map((emp) => {
    const [firstName, ...rest] = emp.fullName.split(" ");
    return [firstName, rest.join(" ")].join("\n");
  });
  const chartData = {
    labels,
    series: [
      {
        name: "Average Rating",
        data: empUserRatingMetrics.map((emp) => emp.averageRating),
      },
      {
        name: "Most Recent Rating",
        data: empUserRatingMetrics.map((emp) => emp.mostRecentRating),
      },
    ],
  };

  const chartSetting = {
    yAxis: [
      {
        label: 'Ratings',
        width: 60,
      },
    ],
  };

  return (
    <div>
    <BarChart
      xAxis={[
        {
          scaleType: "band",
          data: chartData.labels,
          tickLabelStyle: { fontSize: 10, fill: "#333" }, 
        },
      ]}
      series={chartData.series.map((s, i) => ({
        ...s,
        color: i === 0 ? "#BCD5F0" : "#2C6FB5", 
      }))}
      width={440}
      height={260}
      sx={{
        "& .MuiBarElement-root": {
          rx: 6, 
        },
      }}
      {...chartSetting}
    />
    {/* Custom Legend Row */}
    <div className="flex justify-center items-center gap-3 pb-3">
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#BCD5F0" }}></span>
        <span className="text-zinc-700 text-sm">Average Rating</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#2C6FB5" }}></span>
        <span className="text-zinc-700 text-sm">Most Recent Rating</span>
      </div>
    </div>
    </div>
  );
};

export default BarChartCard;