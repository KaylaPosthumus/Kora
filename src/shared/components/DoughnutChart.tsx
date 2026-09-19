import * as React from 'react';
import { PieChart } from '@mui/x-charts/PieChart';

  interface DoughnutChartCardProps {
    employeeStatusTotals: {
      totalEmployees: number;
      totalFullTimeEmployees: number;
      totalPartTimeEmployees: number;
      totalInternEmployees: number;
      totalContractEmployees: number;
      totalSuspendedEmployees: number;
    };
  }

  // The DoughnutChartCard component displays a doughnut chart with employee status totals
  const DoughnutChartCard: React.FC<DoughnutChartCardProps> = ({ employeeStatusTotals }) => {
    // Structure the Data for the doughnut chart
    const doughnutData = [
      { id: 0, value: employeeStatusTotals.totalFullTimeEmployees, label: 'Full Time', color: '#88A764' },
      { id: 1, value: employeeStatusTotals.totalPartTimeEmployees, label: 'Part Time', color: '#FF8904' },
      { id: 2, value: employeeStatusTotals.totalInternEmployees, label: 'Intern', color: '#FFDF20' },
      { id: 3, value: employeeStatusTotals.totalContractEmployees, label: 'Contract', color: '#0092B8' },
      { id: 4, value: employeeStatusTotals.totalSuspendedEmployees, label: 'Suspended', color: '#FF6467' },
    ];

  return (
    <div>
      <PieChart
        series={[
          {
            data: doughnutData,
            innerRadius: 50,
            outerRadius: 80,
            cornerRadius: 4,
            paddingAngle: 1,
          },
        ]}
        width={230}
        height={235}
        sx={{
          '& .MuiPieArc-root': {
            stroke: '#fff',
            strokeWidth: 2,
          },
        }}
        hideLegend = {true}
      />
      <div className='flex flex-col items-center justify-center' style={{ marginTop: '-145px', marginBottom: '65px' }}>
        <h1 className='text-zinc-900 font-semibold text-3xl'>{employeeStatusTotals.totalEmployees}</h1>
        <p className='text-zinc-900 text-xs'>Employees</p>
      </div>

      {/* Custom Legend Row */}
      <div className="flex flex-wrap justify-center p-2 gap-2 mt-2 text-sm">
        {doughnutData.map((item) => (
          <div key={item.id} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DoughnutChartCard;