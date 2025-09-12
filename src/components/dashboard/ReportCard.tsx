"use client";

import React, { ReactNode, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, HelpCircle } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Props = {
    id: string;
    title: string;
    description: string;
    tooltip: string;
    children: ReactNode;
    csvData?: any[];
    csvFilename?: string;
    pdfFilename?: string;
};

function exportCSV(data: any[], filename: string) {
    import("papaparse").then(Papa => {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    });
}

async function exportPDF(elementId: string, filename: string) {
    const input = document.getElementById(elementId);
    if (!input) return;
    const canvas = await html2canvas(input);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 10, width, height);
    pdf.save(filename);
}

export default function ReportCard({
    id,
    title,
    description,
    tooltip,
    children,
    csvData,
    csvFilename,
    pdfFilename,
}: Props) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <Card className="mb-8 relative" id={id}>
            {/* Ícone de ? no canto superior direito */}
            <div
                className="absolute top-4 right-4 z-20 flex items-center"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(show => !show)}
                tabIndex={0}
            >
                <HelpCircle
                    size={32}
                    strokeWidth={2.5}
                    className="text-yellow-400 drop-shadow-sm transition-transform"
                    style={{
                        filter: "drop-shadow(0 2px 2px #FFD70055)",
                        background: "white",
                        borderRadius: "50%",
                        padding: "2px",
                        border: "2px solid #FFD700",
                        boxShadow: "0 2px 12px #FFD70044",
                    }}
                />
                {showTooltip && (
                    <div className="absolute right-0 top-10 z-30 bg-white border border-yellow-300 shadow-lg px-4 py-2 rounded text-sm max-w-xs w-max text-black whitespace-pre-line animate-fadeIn">
                        {tooltip}
                    </div>
                )}
            </div>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {children}
                {(csvData && csvFilename) && (
                    <div className="flex gap-2 mt-6">
                        <Button
                            style={{
                                background: "linear-gradient(90deg, #FFD700 0%, #FFEA70 100%)",
                                color: "#684F1D",
                                border: "1px solid #FFD700",
                                fontWeight: "bold",
                                boxShadow: "0 2px 8px #FFD70044",
                            }}
                            onClick={() => exportPDF(id, pdfFilename || "relatorio.pdf")}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Exportar PDF
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => exportCSV(csvData, csvFilename)}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Exportar CSV
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}