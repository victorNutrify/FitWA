"use client";

import React from "react";
import ReportCard from "./ReportCard";

type CaloriesByHour = {
    hora: string;
    segunda: number;
    terca: number;
    quarta: number;
    quinta: number;
    sexta: number;
    sabado: number;
    domingo: number;
};

type Props = {
    data: CaloriesByHour[];
};

export default function CaloriesByHourTable({ data }: Props) {
    return (
        <ReportCard
            id="calories-by-hour"
            title="Distribuição das calorias por horário"
            description="Em quais horários você costuma consumir mais calorias? (Por dia da semana)"
            tooltip={`Esse gráfico mostra em quais horários do dia você consome mais calorias, distribuído por cada dia da semana. Ajuda a identificar padrões de ingestão e oportunidades para ajustes.`}
            csvData={data}
            csvFilename="calorias_por_horario.csv"
            pdfFilename="calorias_por_horario.pdf"
        >
            <div className="overflow-x-auto" id="calories-by-hour-table">
                <table className="min-w-full text-sm border-separate border-spacing-0 rounded-md shadow">
                    <thead>
                        <tr className="bg-muted">
                            <th className="px-4 py-2 text-left font-bold border-b">Horário</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Segunda</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Terça</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Quarta</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Quinta</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Sexta</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Sábado</th>
                            <th className="px-4 py-2 text-center font-bold border-b">Domingo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={row.hora} className={idx % 2 === 0 ? "bg-white" : "bg-muted/50"}>
                                <td className="px-4 py-2 font-bold border-b">{row.hora}</td>
                                <td className="px-4 py-2 text-center border-b">{row.segunda}</td>
                                <td className="px-4 py-2 text-center border-b">{row.terca}</td>
                                <td className="px-4 py-2 text-center border-b">{row.quarta}</td>
                                <td className="px-4 py-2 text-center border-b">{row.quinta}</td>
                                <td className="px-4 py-2 text-center border-b">{row.sexta}</td>
                                <td className="px-4 py-2 text-center border-b">{row.sabado}</td>
                                <td className="px-4 py-2 text-center border-b">{row.domingo}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ReportCard>
    );
}