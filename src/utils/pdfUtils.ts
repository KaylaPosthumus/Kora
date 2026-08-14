import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import dayjs from "dayjs";
import { EmpUser } from "../interfaces/people/empUser";
import { GenderLabels, EmployTypeLabels, PayCycleLabels } from "../types/common";
import { formatRandAmount } from "./formatUtils";

pdfMake.vfs = pdfFonts;

export const generatePayrollPDF = async (empUser: EmpUser) => {
  // Load image
  const response = await fetch("/src/assets/logos/cori_logo_green.png");
  const blob = await response.blob();
  const reader = new FileReader();

  const logoDataUrl = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  const docDefinition = {
    pageSize: "A4",
    background: function () {
      return {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: 595.28,
            h: 841.89,
            color: "#f8f9f8",
          },
        ],
      };
    },
    content: [
      {
        image: logoDataUrl,
        height: 35,
        width: 171,
        margin: [0, 0, 0, 25],
      },
      { text: "Employee Payroll", style: "header", marginBottom: 16 },
      { text: "Personal Info", style: "subheading" },
      {
        table: {
          widths: ["30%", "70%"],
          body: [
            ["Full Name:", empUser.fullName],
            ["Gender:", GenderLabels[empUser.gender]],
            ["Employee ID:", empUser.employeeId],
            ["Email:", empUser.email],
            ["Phone Number:", empUser.phoneNumber],
            ["Date of Birth:", dayjs(empUser.dateOfBirth).format("DD MMM YYYY")],
          ],
        },
        layout: {
          fillColor: function () {
            return "#ffffff";
          },
          hLineWidth: function () {
            return 0;
          },
          vLineWidth: function () {
            return 0;
          },
          hLineColor: function () {
            return "#e8e8e8";
          },
          vLineColor: function () {
            return "#e8e8e8";
          },
          paddingLeft: function () {
            return 8;
          },
          paddingRight: function () {
            return 8;
          },
          paddingTop: function () {
            return 8;
          },
          paddingBottom: function () {
            return 8;
          },
        },
        margin: [0, 8, 0, 0],
      },
      { text: "Employment", style: "subheading", marginTop: 24 },
      {
        table: {
          widths: ["30%", "70%"],
          body: [
            ["Job Title:", empUser.jobTitle],
            ["Department:", empUser.department],
            ["Employment Type:", EmployTypeLabels[empUser.employType]],
            ["Employment Date:", dayjs(empUser.employDate).format("DD MMM YYYY")],
            ["Salary Amount:", formatRandAmount(empUser.salaryAmount)],
            ["Pay Cycle:", PayCycleLabels[empUser.payCycle]],
            ["Last Paid Date:", dayjs(empUser.lastPaidDate).format("DD MMM YYYY")],
            ["Suspension Status:", empUser.isSuspended ? "Suspended" : "Not Suspended"],
          ],
        },
        layout: {
          fillColor: function () {
            return "#ffffff";
          },
          hLineWidth: function () {
            return 0;
          },
          vLineWidth: function () {
            return 0;
          },
          hLineColor: function () {
            return "#e8e8e8";
          },
          vLineColor: function () {
            return "#e8e8e8";
          },
          paddingLeft: function () {
            return 8;
          },
          paddingRight: function () {
            return 8;
          },
          paddingTop: function () {
            return 8;
          },
          paddingBottom: function () {
            return 8;
          },
        },
        margin: [0, 8, 0, 0],
      },
      //   Date of document creation
      {
        text: `Document created on ${dayjs().format("DD MMM YYYY")}`,
        style: "smalltext",
        marginTop: 16,
      },
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
      },
      subheading: {
        fontSize: 16,
        bold: true,
        color: "#6D8650",
      },
      smalltext: {
        fontSize: 12,
        color: "#9c9c9c",
      },
    },
  };

  pdfMake.createPdf(docDefinition as any).download(`${empUser.fullName}_Payroll.pdf`);
};
