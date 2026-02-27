export const downloadCsv = (fileName: string, rows: Array<Record<string, string | number>>): void => {
    if (rows.length === 0) {
        return;
    }

    const columns = Object.keys(rows[0]);
    const escapeCell = (value: string | number): string => {
        const stringValue = String(value ?? '');
        const escaped = stringValue.replaceAll('"', '""');
        return `"${escaped}"`;
    };

    const lines = [
        columns.join(','),
        ...rows.map((row) => columns.map((column) => escapeCell(row[column] ?? '')).join(',')),
    ];

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
};
