import React from "react";
import { BarChart } from "@mui/x-charts/BarChart";

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
      return <div className="text-center text-zinc-500">No data available</div>;
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
        color: i === 0 ? "#CEDBC0" : "#88A764", 
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
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#CEDBC0" }}></span>
        <span className="text-zinc-700 text-sm">Average Rating</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#88A764" }}></span>
        <span className="text-zinc-700 text-sm">Most Recent Rating</span>
      </div>
    </div>
    </div>
  );
};

export default BarChartCard;